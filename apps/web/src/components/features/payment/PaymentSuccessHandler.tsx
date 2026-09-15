'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getTestCheckoutStatus } from '@/app/payment/actions';
import { Header } from '@/components/layout/Header';

export function PaymentSuccessHandler({ sessionId }: { sessionId: string }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const check = async () => {
      try {
        const result = await getTestCheckoutStatus(sessionId);
        if (cancelled) return;
        if (result.paid) { setBalance(result.balance ?? 0); setWaiting(false); return; }
      } catch { if (cancelled) return; }
      if (++attempts < 8) timer = setTimeout(check, 2000);
      else setWaiting(false);
    };
    void check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [sessionId]);
  return (
    <div className="min-h-screen bg-brand-dark">
      <Header title="Test checkout" />
      <div className="pt-24 px-6 space-y-4 text-center">
        <h1 className="text-xl font-semibold">{balance !== null ? 'Credits confirmed' : waiting ? 'Confirming your test checkout...' : 'Confirmation is still pending'}</h1>
        <p className="text-sm text-brand-text-dim">{balance !== null ? `Your current balance is ${balance} credits.` : 'Your balance updates only after the server receives payment confirmation. You can return here to check again.'}</p>
        <Link href="/home" className="inline-block rounded-lg bg-brand-blue text-brand-dark px-5 py-3">Back to home</Link>
      </div>
    </div>
  );
}
