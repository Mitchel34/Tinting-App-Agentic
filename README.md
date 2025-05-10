# Window Tinting Service Demo

This repository contains a demo web application for a window tinting service, showcasing a simple, AI-enhanced user experience with account management, payment processing, and automated email workflows. Built as a learning project, it demonstrates the integration of modern web technologies to create a functional, cost-free demo using free-tier services.

## Features
- **User Authentication**: Secure signup and login using Firebase Authentication (email/password).
- **Service Selection & Payment**: Browse window tinting services (e.g., Standard Tint - $200, Premium Tint - $350) and complete payments via Stripe (test mode).
- **Automated Emails**: Sends a welcome email on account creation and a service confirmation email with receipt details using SendGrid.
- **AI Chatbot**: A client-side, rule-based chatbot that answers common FAQs about window tinting (e.g., "What is window tinting?", "How much does it cost?").
- **Data Management**: Stores user and order data in Firestore, Firebase's scalable NoSQL database.

## Tech Stack
- **Frontend**: Next.js for a responsive, server-rendered web app.
- **Backend**: Firebase Functions for server-side logic (email sending, payment processing).
- **Database**: Firestore for storing user profiles and order details.
- **Authentication**: Firebase Authentication for secure user management.
- **Payments**: Stripe for seamless checkout (test mode, no transaction fees).
- **Emails**: SendGrid for automated welcome and confirmation emails.
- **Deployment**: Deployable on Vercel (free tier) for easy hosting.

## Purpose
This project serves as a beginner-friendly demo to explore:
- Building full-stack web apps with Next.js and Firebase.
- Integrating payment systems with Stripe.
- Automating workflows with serverless functions and email APIs.
- Creating a simple AI chatbot for customer interaction.
- Leveraging free-tier services to minimize costs.

## Getting Started
1. Clone the repo: `git clone https://github.com/your-username/window-tinting-demo.git`
2. Install dependencies: `npm install`
3. Set up Firebase, Stripe, and SendGrid accounts (free tiers).
4. Configure environment variables (see `.env.example`).
5. Run locally: `npm run dev`
6. Deploy to Vercel for a live demo.

## Free Tier Usage
- **Firebase**: Free for Authentication, 1 GB Firestore storage, 20,000 daily Function invocations.
- **Stripe**: Free in test mode.
- **SendGrid**: Free for 100 emails/day.
- **Vercel**: Free hosting for Next.js apps.

## Contributing
Contributions are welcome! Feel free to submit issues, suggest features, or open pull requests to improve the demo.

## License
[MIT License](LICENSE) - Free to use, modify, and distribute.

---

This description is concise, highlights the project's purpose and features, and provides clear instructions for setup and usage. It’s tailored for a GitHub repository to attract developers interested in learning or contributing. Let me know if you’d like to tweak the tone, add specific details (e.g., your GitHub username), or include additional sections!