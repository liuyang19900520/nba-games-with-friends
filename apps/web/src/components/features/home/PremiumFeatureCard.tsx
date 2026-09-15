'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useCheckout } from '@/hooks/useCheckout';

export function PremiumFeatureCard({ userId }: { userId: string | null }) {
  const { loading, error, startCheckout } = useCheckout();
  return (
    <div className="rounded-xl bg-brand-dark border border-brand-card-border p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-brand-blue" />
        <h2 className="text-xl font-semibold text-white">Try the basketball assistant</h2>
      </div>
      <p className="text-sm leading-relaxed text-brand-text-dim">
        Explore matchup analysis and build a five-player lineup. A completed request uses one demo credit.
      </p>
      <p className="text-xs text-brand-text-dim">Test checkout only. No real payment is collected.</p>
      {userId ? (
        <button onClick={startCheckout} disabled={loading} className="w-full rounded-lg bg-brand-blue py-3 px-4 font-medium text-brand-dark disabled:opacity-50">
          {loading ? 'Opening checkout...' : 'Get 5 demo credits'}
        </button>
      ) : (
        <Link href="/login?redirect=/home" className="block rounded-lg bg-brand-blue py-3 text-center font-medium text-brand-dark">Sign in to try</Link>
      )}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
