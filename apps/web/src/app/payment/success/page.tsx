import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PaymentSuccessHandler } from '@/components/features/payment/PaymentSuccessHandler';

/**
 * Payment Success Page
 * Verifies payment and redirects to home page.
 */
export default function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  return (
    <Suspense fallback={<PaymentLoadingUI />}>
      <PaymentSuccessContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PaymentSuccessContent({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;

  // If no session_id, redirect to home
  if (!params.session_id) {
    redirect('/home');
  }

  // Show success handler component which will redirect after brief display
  return <PaymentSuccessHandler sessionId={params.session_id} />;
}

function PaymentLoadingUI() {
  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-brand-text-light mt-4">Processing payment...</p>
      </div>
    </div>
  );
}
