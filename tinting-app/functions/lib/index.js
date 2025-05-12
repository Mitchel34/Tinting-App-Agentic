"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripewebhook = exports.createstripecheckoutsession = exports.sendwelcomeemail = void 0;
const admin = __importStar(require("firebase-admin"));
// Fix SendGrid import
const mail_1 = __importDefault(require("@sendgrid/mail"));
const stripe_1 = __importDefault(require("stripe"));
const functions = __importStar(require("firebase-functions"));
// Initialize Firebase Admin SDK
admin.initializeApp();
// Environment configuration 
const stripeSecretKey = (_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret_key;
const sendgridApiKey = (_b = functions.config().sendgrid) === null || _b === void 0 ? void 0 : _b.api_key;
const stripeWebhookSecret = (_c = functions.config().stripe) === null || _c === void 0 ? void 0 : _c.webhook_secret;
// Initialize Stripe
if (!stripeSecretKey) {
    console.error("Stripe secret key is not set. Ensure STRIPE_SECRET_KEY is set in Firebase config.");
}
const stripe = new stripe_1.default(stripeSecretKey || "", {});
// Initialize SendGrid
if (!sendgridApiKey) {
    console.error("SendGrid API key is not set. Ensure SENDGRID_API_KEY is set in Firebase config.");
}
else {
    mail_1.default.setApiKey(sendgridApiKey);
}
const db = admin.firestore();
// --- Firebase Function: Send Welcome Email ---
exports.sendwelcomeemail = functions.auth.user().onCreate(async (user) => {
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
        await mail_1.default.send(msg);
        console.log("Welcome email sent to:", user.email, { uid: user.uid });
    }
    catch (error) {
        console.error("Error sending welcome email:", { uid: user.uid, errorMessage: error.message, errorDetails: error });
        if (error.response) {
            console.error("SendGrid error response:", error.response.body);
        }
    }
});
exports.createstripecheckoutsession = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        console.warn("Unauthenticated user tried to create checkout session.");
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const { priceId, successUrl, cancelUrl } = data;
    if (!priceId || !successUrl || !cancelUrl) {
        console.error("Missing parameters for creating checkout session.", { uid: context.auth.uid, data });
        throw new functions.https.HttpsError("invalid-argument", "Missing priceId, successUrl, or cancelUrl.");
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
    }
    catch (error) {
        console.error("Error creating Stripe checkout session:", { uid: userId, errorMessage: error.message, errorDetails: error });
        throw new functions.https.HttpsError("internal", "Could not create Stripe checkout session.");
    }
});
// --- Firebase Function: Handle Stripe Webhooks ---
exports.stripewebhook = functions.https.onRequest(async (req, res) => {
    var _a, _b;
    const signature = req.headers["stripe-signature"];
    if (!stripeWebhookSecret) {
        console.error("Stripe webhook secret is not configured. Ensure STRIPE_WEBHOOK_SECRET is set in Firebase config.");
        res.status(500).send("Webhook Error: Server configuration error - webhook secret not set.");
        return;
    }
    let event;
    try {
        // Now TypeScript knows req.rawBody exists
        event = stripe.webhooks.constructEvent(req.rawBody, signature, stripeWebhookSecret);
    }
    catch (err) {
        console.error("⚠️ Webhook signature verification failed.", { errorMessage: err.message });
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    console.log("Received Stripe event:", { type: event.type, id: event.id });
    switch (event.type) {
        case "checkout.session.completed":
            const session = event.data.object;
            console.log("Checkout session completed:", { sessionId: session.id, userId: session.client_reference_id });
            const userId = session.client_reference_id;
            const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : (_a = session.payment_intent) === null || _a === void 0 ? void 0 : _a.id;
            const amountTotal = session.amount_total;
            const currency = session.currency;
            const customerEmail = (_b = session.customer_details) === null || _b === void 0 ? void 0 : _b.email;
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
                    }
                    catch (authError) {
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
              <p>Amount Paid: ${orderData.amount} ${currency === null || currency === void 0 ? void 0 : currency.toUpperCase()}</p>
              <p>We will contact you shortly to schedule your service.</p>
            `,
                    };
                    await mail_1.default.send(confirmationMsg);
                    console.log("Confirmation email sent.", { orderId: orderRef.id, email: emailToSendTo });
                }
                else {
                    console.warn(`Could not send confirmation email for order ${orderRef.id}, no email found.`, { orderId: orderRef.id });
                }
            }
            catch (dbError) {
                console.error("Error creating order or sending confirmation email:", { errorMessage: dbError.message, errorDetails: dbError });
            }
            break;
        default:
            console.log(`Unhandled Stripe event type: ${event.type}`, { eventId: event.id });
    }
    res.status(200).send();
});
//# sourceMappingURL=index.js.map