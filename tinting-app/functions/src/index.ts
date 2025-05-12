import * as admin from "firebase-admin";
import sgMail from "@sendgrid/mail";
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
const stripeSecretKey = functions.config().stripe?.secret_key;
const sendgridApiKey = functions.config().sendgrid?.api_key;
const stripeWebhookSecret = functions.config().stripe?.webhook_secret;

// Initialize Stripe
if (!stripeSecretKey) {
  console.error("Stripe secret key is not set. Ensure STRIPE_SECRET_KEY is set in Firebase config.");
}
const stripe = new Stripe(stripeSecretKey || "", {});

// Initialize SendGrid
let sendgridEnabled = false;
if (!sendgridApiKey) {
  console.error("SendGrid API key is not set. Email functionality will be disabled.");
} else if (!sendgridApiKey.startsWith("SG.")) {
  console.error("SendGrid API key does not match expected format (should start with 'SG.'). Email functionality will be disabled.");
} else {
  sgMail.setApiKey(sendgridApiKey);
  sendgridEnabled = true;
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
    throw new functions.https.HttpsError("internal", "Error creating checkout session.");
  }
});

// --- Firebase Function: Handle Stripe Webhook ---
export const stripewebhook = functions.https.onRequest(async (req: FirebaseFunctionsRequest, res: Response) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.error("No Stripe signature found in webhook request");
    return res.status(400).send("No Stripe signature found");
  }

  if (!stripeWebhookSecret) {
    console.error("Stripe webhook secret is not set. Cannot verify webhook signatures.");
    return res.status(500).send("Webhook secret not configured");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, stripeWebhookSecret);
  } catch (err: any) {
    console.error("Error verifying webhook signature:", { errorMessage: err.message, errorDetails: err });
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  console.log("Received Stripe webhook event:", { eventType: event.type, eventId: event.id });

  // Handle specific event types
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      
      try {
        // Get the user ID from the session metadata
        const userId = session.metadata?.userId;

        if (!userId) {
          console.error("No user ID found in session metadata", { sessionId: session.id });
          break;
        }

        // Create a new order document in Firestore
        const orderRef = await db.collection('orders').add({
          userId: userId,
          amount: session.amount_total,
          currency: session.currency,
          status: 'completed',
          paymentId: session.payment_intent,
          created: admin.firestore.FieldValue.serverTimestamp(),
          items: [{
            // You may want to fetch the product details here or store them in the session metadata
            priceId: session.line_items?.data[0]?.price?.id || 'unknown',
            quantity: session.line_items?.data[0]?.quantity || 1,
          }]
        });

        console.log("Order created successfully", { orderId: orderRef.id, userId });

        // Send confirmation email to user
        if (sendgridEnabled) {
          const userRecord = await admin.auth().getUser(userId);
          
          if (userRecord.email) {
            const msg = {
              to: userRecord.email,
              from: 'tinting-app@proton.me',
              subject: 'Your Order Confirmation',
              html: `
                <h1>Thank you for your order!</h1>
                <p>Your payment has been processed successfully.</p>
                <p>Order ID: ${orderRef.id}</p>
                <p>Amount: ${(session.amount_total || 0) / 100} ${session.currency?.toUpperCase() || 'USD'}</p>
                <p>We'll be in touch shortly to schedule your window tinting service.</p>
              `,
            };

            await sgMail.send(msg);
            console.log("Order confirmation email sent", { orderId: orderRef.id, email: userRecord.email });
          } else {
            console.warn("Could not send confirmation email for order", { orderId: orderRef.id, error: "No email found for user" });
          }
        } else {
          console.warn("SendGrid is not enabled, skipping order confirmation email");
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
