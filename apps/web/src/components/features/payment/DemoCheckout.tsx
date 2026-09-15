'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { claimDemoCredits } from '@/app/payment/actions';

export function DemoCheckout() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ balance?: number; error?: string }>({});
  return (
    <div className="rounded-xl border border-brand-card-border bg-brand-dark p-6 space-y-4">
      <h1 className="text-xl font-semibold text-white">Demo checkout</h1>
      <p className="text-sm text-brand-text-dim">Add 5 test credits. No card details or real payment. One top-up per UTC day after you use your remaining credits.</p>
      {result.balance !== undefined ? (
        <div role="status" className="space-y-4">
          <p>Your balance is now {result.balance} credits.</p>
          <Link href="/home" className="block rounded-lg bg-brand-blue text-brand-dark py-3 text-center">Try the assistant</Link>
        </div>
      ) : (
        <button disabled={pending} onClick={() => startTransition(async () => setResult(await claimDemoCredits()))} className="w-full rounded-lg bg-brand-blue text-brand-dark py-3 disabled:opacity-50">
          {pending ? 'Confirming...' : 'Confirm demo top-up'}
        </button>
      )}
      {result.error && <p role="alert" className="text-sm text-red-400">{result.error}</p>}
      <Link href="/home" className="block text-sm text-brand-text-dim">Cancel and return home</Link>
    </div>
  );
}
