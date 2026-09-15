import { redirect } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { DemoCheckout } from '@/components/features/payment/DemoCheckout';
import { getPaymentMode } from '@/lib/server/config';
import { createClient } from '@/lib/auth/supabase';

export default async function DemoPaymentPage() {
  if (getPaymentMode() !== 'demo') redirect('/payment');
  let authenticated = false;
  try {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    authenticated = !!user;
  } catch { /* Login explains the missing session. */ }
  if (!authenticated) redirect('/login?redirect=/payment/demo');
  return <div><Header title="Demo checkout" showBack /><div className="pt-24 px-4"><DemoCheckout /></div></div>;
}
