'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';

interface PaymentSuccessHandlerProps {
  sessionId: string;
}

/**
 * Simple payment success page.
 * Shows a success message and redirects to home after 1.5s.
 * Credits are handled optimistically on the home page.
 */
export function PaymentSuccessHandler({ sessionId: _sessionId }: PaymentSuccessHandlerProps) {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/home?payment=success');
    }, 1500);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <Header title="Payment" />
      <div className="flex-1 flex items-center justify-center pt-[60px] px-4">
        <div className="max-w-md w-full bg-brand-dark rounded-xl border border-brand-card-border p-8 text-center">
          <CheckCircle
            className="w-16 h-16 text-green-500 mx-auto mb-4"
            style={{ filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.6))' }}
          />
          <h1 className="text-2xl font-semibold text-white mb-2">Payment Successful!</h1>
          <p className="text-brand-text-dim mb-4">
            Your AI prediction credits have been added.
          </p>
          <p className="text-brand-text-dim text-sm">
            Redirecting...
          </p>
        </div>
      </div>
    </div>
  );
}
