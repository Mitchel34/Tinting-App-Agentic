import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as sgMail from "@sendgrid/mail";
import Stripe from "stripe";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Initialize Stripe
// Make sure to set STRIPE_SECRET_KEY in Firebase environment configuration
// For local testing, you can use: functions.config().stripe.secret_key
const stripe = new Stripe(functions.config().stripe?.secret_key || process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10", // Use the latest API version
});

// Initialize SendGrid
// Make sure to set SENDGRID_API_KEY in Firebase environment configuration
// For local testing, you can use: functions.config().sendgrid.api_key
sgMail.setApiKey(functions.config().sendgrid?.api_key || process.env.SENDGRID_API_KEY!);

const db = admin.firestore();

// --- Firebase Function: Send Welcome Email ---
export const sendWelcomeEmail = functions.auth.user().onCreate(async (user) => {
  if (!user.email) {
    console.log("User does not have an email address. Skipping welcome email.");
    return;
  }

  const msg = {
    to: user.email,
    from: "your-verified-sendgrid-email@example.com", // CHANGE THIS to your verified SendGrid sender email
    subject: "Welcome to Our Window Tinting Service!",
    html: \`
      <h1>Welcome, \${user.displayName || 'User'}!</h1>
      <p>Thank you for signing up for our window tinting service.</p>
      <p>We're excited to have you on board.</p>
    \`,
  };

  try {
    await sgMail.send(msg);
    console.log("Welcome email sent to:", user.email);
  } catch (error) {
    console.error("Error sending welcome email:", error);
    if (error.response) {
      console.error(error.response.body)
    }
  }
});

// --- Firebase Function: Create Stripe Checkout Session ---
export const createStripeCheckoutSession = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const { priceId, successUrl, cancelUrl } = data;

  if (!priceId || !successUrl || !cancelUrl) {
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
          price: priceId, // e.g., price_1xxxxxxxxxxxxxx from your Stripe dashboard
          quantity: 1,
        },
      ],
      success_url: successUrl, // URL to redirect to on successful payment
      cancel_url: cancelUrl,   // URL to redirect to if payment is cancelled
      client_reference_id: userId, // Store userId to link payment to user
      metadata: {
        userId: userId,
        // Add any other metadata you need, like the specific service ID
      }
    });

    return { sessionId: session.id };
  } catch (error) {
    console.error("Error creating Stripe checkout session:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Could not create Stripe checkout session."
    );
  }
});

// --- Firebase Function: Handle Stripe Webhooks ---
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const signature = req.headers["stripe-signature"] as string;
  // Make sure to set STRIPE_WEBHOOK_SECRET in Firebase environment configuration
  // For local testing, you can use: functions.config().stripe.webhook_secret
  const endpointSecret = functions.config().stripe?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, endpointSecret);
  } catch (err) {
    console.error("⚠️  Webhook signature verification failed.", err.message);
    res.status(400).send(\`Webhook Error: \${err.message}\`);
    return;
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("Checkout session completed:", session.id);

      const userId = session.client_reference_id;
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
      const amountTotal = session.amount_total; // Amount in smallest currency unit (e.g., cents)
      const currency = session.currency;
      const customerEmail = session.customer_details?.email;


      if (!userId || !paymentIntentId || amountTotal === null || amountTotal === undefined) {
        console.error("Missing required data from session:", session);
        res.status(400).send("Webhook Error: Missing data in session.");
        return;
      }

      // Create order in Firestore
      const orderData = {
        userId,
        paymentIntentId,
        amount: amountTotal / 100, // Convert to dollars/main currency unit
        currency,
        status: "paid",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        customerEmail: customerEmail || "N/A",
        // Add more details like items purchased from session.metadata or by fetching line items
      };

      try {
        const orderRef = await db.collection("orders").add(orderData);
        console.log(\`Order \${orderRef.id} created for user \${userId}\`);

        // Send confirmation email
        if (customerEmail) {
          const confirmationMsg = {
            to: customerEmail,
            from: "your-verified-sendgrid-email@example.com", // CHANGE THIS
            subject: "Your Window Tinting Service Order Confirmation",
            html: \`
              <h1>Order Confirmed!</h1>
              <p>Thank you for your purchase.</p>
              <p>Order ID: \${orderRef.id}</p>
              <p>Amount Paid: \${orderData.amount} \${currency?.toUpperCase()}</p>
              <p>We will contact you shortly to schedule your service.</p>
            \`,
          };
          await sgMail.send(confirmationMsg);
          console.log("Confirmation email sent to:", customerEmail);
        } else if (userId) {
            // Fallback: try to get user email from Firebase Auth if not in Stripe session
            const userRecord = await admin.auth().getUser(userId);
            if (userRecord.email) {
                 const confirmationMsg = {
                    to: userRecord.email,
                    from: "your-verified-sendgrid-email@example.com", // CHANGE THIS
                    subject: "Your Window Tinting Service Order Confirmation",
                    html: \`
                    <h1>Order Confirmed!</h1>
                    <p>Thank you for your purchase.</p>
                    <p>Order ID: \${orderRef.id}</p>
                    <p>Amount Paid: \${orderData.amount} \${currency?.toUpperCase()}</p>
                    <p>We will contact you shortly to schedule your service.</p>
                    \`,
                };
                await sgMail.send(confirmationMsg);
                console.log("Confirmation email sent to user (from Auth):", userRecord.email);
            } else {
                console.warn(\`Could not send confirmation email for order \${orderRef.id}, no email found.\`)
            }
        }

      } catch (dbError) {
        console.error("Error creating order or sending confirmation email:", dbError);
        res.status(500).send("Internal Server Error");
        return;
      }
      break;
    // Add other event types to handle as needed (e.g., payment_intent.succeeded, payment_intent.payment_failed)
    default:
      console.log(\`Unhandled event type \${event.type}\`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.status(200).send();
});

// Placeholder for other functions if needed
// export const anotherFunction = functions.https.onCall(async (data, context) => {
//   // ...
// });

