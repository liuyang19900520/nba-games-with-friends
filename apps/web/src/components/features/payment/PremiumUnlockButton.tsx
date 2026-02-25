'use client';

import { useState } from 'react';

export function PremiumUnlockButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_PAYMENT_API_URL}/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, priceId: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID }),
      });
      
      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error('Payment failed:', err);
      alert('Failed to initiate payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleUnlock}
      disabled={loading}
      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow-lg transition-all disabled:opacity-50"
    >
      {loading ? 'Processing...' : 'Get 5 AI Credits (PayPay/Card)'}
    </button>
  );
}
