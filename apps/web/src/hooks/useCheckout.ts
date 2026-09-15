'use client';
import { useRef, useState } from 'react';

export function useCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  const busy = useRef(false);
  const startCheckout = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch('/api/payment/create-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId.current }, body: '{}',
      });
      const data = await response.json();
      if (response.status === 401) { window.location.assign('/login?redirect=/payment'); return; }
      if (!response.ok || typeof data.url !== 'string') throw new Error(data.error || 'Checkout is temporarily unavailable.');
      const target = new URL(data.url, window.location.origin);
      if (target.origin !== window.location.origin && !(target.protocol === 'https:' && target.hostname === 'checkout.stripe.com')) throw new Error('Invalid checkout address.');
      window.location.assign(target.href);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to open checkout.'); }
    finally { busy.current = false; setLoading(false); }
  };
  return { loading, error, startCheckout };
}
