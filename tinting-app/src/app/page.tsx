'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions as firebaseFunctions } from '@/lib/firebase'; // Assuming firebase.ts is in src/lib
import { loadStripe } from '@stripe/stripe-js';
import Chatbot from './components/Chatbot'; // Import the Chatbot component

// Make sure to replace with your actual Stripe publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Service {
  id: string;
  name: string;
  price: number;
  priceId: string; // Stripe Price ID
  description: string;
}

// Sample services - in a real app, these might come from a database
const services: Service[] = [
  {
    id: 'service_std',
    name: 'Standard Tint',
    price: 200,
    priceId: 'YOUR_STANDARD_TINT_PRICE_ID_FROM_STRIPE', // REPLACE with your actual Stripe Price ID for Standard Tint
    description: 'Basic tinting for all windows.',
  },
  {
    id: 'service_prm',
    name: 'Premium Tint',
    price: 350,
    priceId: 'YOUR_PREMIUM_TINT_PRICE_ID_FROM_STRIPE', // REPLACE with your actual Stripe Price ID for Premium Tint
    description: 'High-quality ceramic tint for maximum heat rejection and UV protection.',
  },
];

export default function ServicesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null); // Stores ID of service being processed
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handlePurchase = async (service: Service) => {
    if (!user) {
      router.push('/login'); // Redirect to login if not authenticated
      return;
    }

    setError(null);
    setProcessingPayment(service.id);

    try {
      const createCheckoutSession = httpsCallable<
        { priceId: string; successUrl: string; cancelUrl: string },
        { sessionId?: string; error?: string }
      >(firebaseFunctions, 'createStripeCheckoutSession');

      const successUrl = `\${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = window.location.href;

      const response = await createCheckoutSession({
        priceId: service.priceId,
        successUrl: successUrl,
        cancelUrl: cancelUrl,
      });

      if (response.data.error || !response.data.sessionId) {
        throw new Error(response.data.error || 'Failed to create checkout session.');
      }

      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe.js has not loaded yet.');
      }

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: response.data.sessionId,
      });

      if (stripeError) {
        console.error("Stripe redirect error:", stripeError);
        setError(stripeError.message || 'Failed to redirect to Stripe.');
      }
    } catch (err: any) {
      console.error("Purchase error:", err);
      setError(err.message || 'An unexpected error occurred during purchase.');
    } finally {
      setProcessingPayment(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold text-center text-gray-900 mb-10">
          Our Window Tinting Services
        </h1>

        {!user && (
          <div className="mb-8 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700">
            <p>
              Please{' '}
              <a href="/login" className="font-bold hover:underline">log in</a> or{' '}
              <a href="/signup" className="font-bold hover:underline">sign up</a>{' '}
              to purchase a service.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-8 p-4 bg-red-100 text-red-700 rounded-md">
            <p><strong>Error:</strong> {error}</p>
          </div>
        )}

        <div className="space-y-8">
          {services.map((service) => (
            <div key={service.id} className="bg-white shadow-lg rounded-lg overflow-hidden">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-800">{service.name}</h2>
                <p className="mt-2 text-gray-600">{service.description}</p>
                <p className="mt-4 text-3xl font-semibold text-gray-900">\${service.price}</p>
                {user && (
                  <button
                    onClick={() => handlePurchase(service)}
                    disabled={processingPayment === service.id || !user}
                    className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition duration-150 ease-in-out"
                  >
                    {processingPayment === service.id ? 'Processing...' : 'Purchase'}
                  </button>
                )}
                {!user && (
                     <button
                        onClick={() => router.push('/login')}
                        className="mt-6 w-full bg-gray-400 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition duration-150 ease-in-out"
                    >
                        Log in to Purchase
                    </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Integrate Chatbot component - remove placeholder div */}
        <Chatbot />

      </div>
    </div>
  );
}
