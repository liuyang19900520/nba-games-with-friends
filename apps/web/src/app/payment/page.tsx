import { Header } from '@/components/layout/Header';
import { PremiumFeatureCard } from '@/components/features/home/PremiumFeatureCard';
import { createClient } from '@/lib/auth/supabase';
import { getPaymentMode } from '@/lib/server/config';

export default async function PaymentPage() {
  let userId: string | null = null;
  try {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    userId = user?.id || null;
  } catch { /* The sign-in entry remains visible when configuration is incomplete. */ }
  return (
    <div className="min-h-screen bg-brand-dark">
      <Header title="Demo credits" showBack />
      <div className="pt-24 px-4 pb-8 space-y-6">
        <PremiumFeatureCard userId={userId} />
        <p className="text-sm text-brand-text-dim">
          {getPaymentMode() === 'demo'
            ? 'The demo checkout adds five credits after confirmation. One top-up per UTC day, when your balance is empty.'
            : 'Stripe test checkout is enabled. Use test card details only; no real payment is collected.'}
        </p>
      </div>
    </div>
  );
}
