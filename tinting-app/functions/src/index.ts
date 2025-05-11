import * as admin from "firebase-admin";
import * as sgMail from "@sendgrid/mail";
import Stripe from "stripe";
import * as functions from "firebase-functions";
import { Request, Response } from "express";

// Add this custom interface for Firebase request with rawBody
interface FirebaseFunctionsRequest extends Request {
  rawBody: Buffer;
}

// Initialize Firebase Admin SDK
admin.initializeApp();

// Environment configuration 
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const sendgridApiKey = process.env.SENDGRID_API_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Initialize Stripe
if (!stripeSecretKey) {
  console.error("Stripe secret key is not set. Ensure STRIPE_SECRET_KEY is set in Firebase config.");
}
const stripe = new Stripe(stripeSecretKey || "", {});

// Initialize SendGrid
if (!sendgridApiKey) {
  console.error("SendGrid API key is not set. Ensure SENDGRID_API_KEY is set in Firebase config.");
} else {
  sgMail.setApiKey(sendgridApiKey);
}

const db = admin.firestore();

// --- Firebase Function: Send Welcome Email ---
export const sendwelcomeemail = functions.auth.user().onCreate(async (user) => {
  if (!user.email) {
    console.log("User does not have an email address. Skipping welcome email.", { uid: user.uid });
    return;
  }

  const msg = {
    to: user.email,
    from: "tinting-app@proton.me",
    subject: "Welcome to Our Window Tinting Service!",
    html: `
      <h1>Welcome, ${user.displayName || 'User'}!</h1>
      <p>Thank you for signing up for our window tinting service.</p>
      <p>We're excited to have you on board.</p>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log("Welcome email sent to:", user.email, { uid: user.uid });
  } catch (error: any) {
    console.error("Error sending welcome email:", { uid: user.uid, errorMessage: error.message, errorDetails: error });
    if (error.response) {
      console.error("SendGrid error response:", error.response.body);
    }
  }
});

// --- Firebase Function: Create Stripe Checkout Session ---
interface CreateCheckoutData {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export const createstripecheckoutsession = functions.https.onCall(async (data: CreateCheckoutData, context) => {
  if (!context.auth) {
    console.warn("Unauthenticated user tried to create checkout session.");
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const { priceId, successUrl, cancelUrl } = data;

  if (!priceId || !successUrl || !cancelUrl) {
    console.error("Missing parameters for creating checkout session.", { uid: context.auth.uid, data });
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing priceId, successUrl, or cancelUrl."
    );
  }

  const userId = context.auth.uid;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        userId: userId,
      }
    });

    console.log("Stripe checkout session created successfully.", { uid: userId, sessionId: session.id });
    return { sessionId: session.id };
  } catch (error: any) {
    console.error("Error creating Stripe checkout session:", { uid: userId, errorMessage: error.message, errorDetails: error });
    throw new functions.https.HttpsError(
      "internal",
      "Could not create Stripe checkout session."
    );
  }
});

// --- Firebase Function: Handle Stripe Webhooks ---
export const stripewebhook = functions.https.onRequest(async (req: FirebaseFunctionsRequest, res: Response) => {
  const signature = req.headers["stripe-signature"] as string;

  if (!stripeWebhookSecret) {
    console.error("Stripe webhook secret is not configured. Ensure STRIPE_WEBHOOK_SECRET is set in Firebase config.");
    res.status(500).send("Webhook Error: Server configuration error - webhook secret not set.");
    return;
  }

  let event: Stripe.Event;

  try {
    // Now TypeScript knows req.rawBody exists
    event = stripe.webhooks.constructEvent(req.rawBody, signature, stripeWebhookSecret);
  } catch (err: any) {
    console.error("⚠️ Webhook signature verification failed.", { errorMessage: err.message });
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  console.log("Received Stripe event:", { type: event.type, id: event.id });

  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("Checkout session completed:", { sessionId: session.id, userId: session.client_reference_id });

      const userId = session.client_reference_id;
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
      const amountTotal = session.amount_total;
      const currency = session.currency;
      const customerEmail = session.customer_details?.email;

      if (!userId || !paymentIntentId || amountTotal === null || amountTotal === undefined) {
        console.error("Missing required data from Stripe session.", { sessionId: session.id, data: session });
        res.status(400).send("Webhook Error: Missing data in session.");
        return;
      }

      const orderData = {
        userId,
        paymentIntentId,
        amount: amountTotal / 100,
        currency,
        status: "paid",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        customerEmail: customerEmail || "N/A",
      };

      try {
        const orderRef = await db.collection("orders").add(orderData);
        console.log(`Order ${orderRef.id} created for user ${userId}`, { orderId: orderRef.id });

        let emailToSendTo = customerEmail;
        if (!emailToSendTo && userId) {
          try {
            const userRecord = await admin.auth().getUser(userId);
            emailToSendTo = userRecord.email;
          } catch (authError: any) {
            console.warn("Could not fetch user email from Auth for order confirmation.", { userId, orderId: orderRef.id, errorMessage: authError.message });
          }
        }

        if (emailToSendTo) {
          const confirmationMsg = {
            to: emailToSendTo,
            from: "tinting-app@proton.me",
            subject: "Your Window Tinting Service Order Confirmation",
            html: `
              <h1>Order Confirmed!</h1>
              <p>Thank you for your purchase.</p>
              <p>Order ID: ${orderRef.id}</p>
              <p>Amount Paid: ${orderData.amount} ${currency?.toUpperCase()}</p>
              <p>We will contact you shortly to schedule your service.</p>
            `,
          };
          await sgMail.send(confirmationMsg);
          console.log("Confirmation email sent.", { orderId: orderRef.id, email: emailToSendTo });
        } else {
          console.warn(`Could not send confirmation email for order ${orderRef.id}, no email found.`, { orderId: orderRef.id });
        }
      } catch (dbError: any) {
        console.error("Error creating order or sending confirmation email:", { errorMessage: dbError.message, errorDetails: dbError });
      }
      break;
    default:
      console.log(`Unhandled Stripe event type: ${event.type}`, { eventId: event.id });
  }

  res.status(200).send();
});
