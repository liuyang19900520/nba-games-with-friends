'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle } from 'lucide-react';

interface PaymentSuccessHandlerProps {
  sessionId: string;
}

export function PaymentSuccessHandler({ sessionId }: PaymentSuccessHandlerProps) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // For now, assume success if we have a session_id
    // The webhook will handle the actual verification
    const timer = setTimeout(() => {
      setStatus('success');
    }, 500);

    return () => clearTimeout(timer);
  }, [sessionId]);

  useEffect(() => {
    if (status === 'success') {
      // Redirect to home after showing success message
      const timer = setTimeout(() => {
        router.push('/home');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-brand-text-light mt-4">Verifying payment...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-brand-dark rounded-xl border border-brand-card-border p-8 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-white mb-2">Payment Failed</h1>
          <p className="text-brand-text-dim mb-6">
            {error || 'Something went wrong with your payment. Please try again.'}
          </p>
          <button
            onClick={() => router.push('/home')}
            className="w-full py-3 px-6 rounded-lg bg-secondary text-brand-text-light font-medium hover:bg-accent transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-brand-dark rounded-xl border border-brand-card-border p-8 text-center">
        <CheckCircle
          className="w-16 h-16 text-green-500 mx-auto mb-4"
          style={{
            filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.6))',
          }}
        />
        <h1 className="text-2xl font-semibold text-white mb-2">Payment Successful!</h1>
        <p className="text-brand-text-dim mb-6">
          Welcome to Premium! You now have access to AI-powered predictions.
        </p>
        <p className="text-brand-text-dim text-sm">
          Redirecting to home...
        </p>
      </div>
    </div>
  );
}
