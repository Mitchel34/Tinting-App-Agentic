# Window Tinting Service Application

A full-stack web application for a window tinting business that allows customers to browse services, create accounts, make payments, and receive order confirmations.

## Features

- **User Authentication**: Secure signup and login with Firebase Authentication
- **Service Selection**: Browse different tinting packages with descriptions and pricing
- **Payment Processing**: Integrated Stripe checkout for secure payments
- **Order Management**: Order creation and storage in Firestore database
- **Email Notifications**: Automated welcome and order confirmation emails via SendGrid
- **Responsive Design**: Mobile-friendly interface built with Next.js
- **Customer Support**: Integrated chatbot for customer inquiries

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, TailwindCSS
- **Backend**: Firebase Cloud Functions
- **Database**: Firebase Firestore
- **Authentication**: Firebase Authentication
- **Payment Processing**: Stripe
- **Email Service**: SendGrid

## Project Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Firebase account
- Stripe account (with API keys)
- SendGrid account (with API key)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/tinting-app.git
   cd tinting-app
   ```

2. **Install dependencies:**
   ```bash
   # Install frontend dependencies
   npm install
   
   # Install Cloud Functions dependencies
   cd functions
   npm install
   cd ..
   ```

3. **Configure environment variables:**
   
   Create a `.env.local` file in the project root:
   ```
   # Firebase Client Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
   
   # Stripe Public Key
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
   ```

4. **Configure Firebase Functions:**
   ```bash
   # Set Stripe secret key
   firebase functions:config:set stripe.secret_key="your_stripe_secret_key"
   
   # Set SendGrid API key
   firebase functions:config:set sendgrid.api_key="your_sendgrid_api_key"
   
   # Set Stripe webhook secret
   firebase functions:config:set stripe.webhook_secret="your_stripe_webhook_secret"
   ```

5. **Deploy Firebase Functions:**
   ```bash
   firebase deploy --only functions
   ```

6. **Configure Stripe webhook:**
   - Go to Stripe Dashboard > Developers > Webhooks
   - Add a new endpoint with your Firebase Function URL:
     `https://us-central1-your-project-id.cloudfunctions.net/stripewebhook`
   - Select the event `checkout.session.completed`
   - Copy the signing secret and update your Firebase config:
     ```bash
     firebase functions:config:set stripe.webhook_secret="your_webhook_signing_secret"
     firebase deploy --only functions
     ```

### Running Locally

```bash
# Start the development server
npm run dev

# Visit http://localhost:3000 in your browser
```

### Running in Production

```bash
# Build the application
npm run build

# Start the production server
npm start
```

## Testing Payment Flow

1. Create an account or log in
2. Browse the available tinting services
3. Click the "Purchase" button on a service
4. Use Stripe test cards for payment:
   - Success: 4242 4242 4242 4242
   - Decline: 4000 0000 0000 0002
   - Authentication Required: 4000 0027 6000 3184
5. Complete the checkout process
6. You'll be redirected to a success page
7. Check your email for order confirmation

## Project Structure

- `/src`: Next.js frontend code
  - `/app`: Application routes and components
  - `/components`: Reusable UI components
  - `/lib`: Utility functions and Firebase client setup
- `/public`: Static assets
- `/functions`: Firebase Cloud Functions
  - `/src`: TypeScript source code
  - `/lib`: Compiled JavaScript (deployed to Firebase)

## Firebase Functions

The application includes several Firebase Cloud Functions:

1. **`sendwelcomeemail`**: Triggered when a new user signs up, sends a welcome email
2. **`createstripecheckoutsession`**: Creates a Stripe checkout session for payment processing
3. **`stripewebhook`**: Processes webhook events from Stripe, creates orders in the database, and sends confirmation emails

## Security Considerations

- API keys and secrets are stored in Firebase environment configuration, not in the codebase
- Stripe webhook verification ensures payment event authenticity
- Firebase Authentication secures user accounts and data

## License

This project is licensed under the MIT License - see the LICENSE file for details.