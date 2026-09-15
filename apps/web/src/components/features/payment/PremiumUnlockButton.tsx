'use client';
import { useCheckout } from '@/hooks/useCheckout';

export function PremiumUnlockButton({ userId }: { userId: string }) {
  const { loading, error, startCheckout } = useCheckout();
  return (
    <div>
      <button onClick={startCheckout} disabled={loading || !userId} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50">
        {loading ? 'Opening checkout...' : 'Get 5 demo credits'}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
