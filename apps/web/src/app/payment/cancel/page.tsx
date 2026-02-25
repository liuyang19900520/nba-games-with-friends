import { redirect } from 'next/navigation';

/**
 * Payment Cancel Page
 * Redirects to home page when user cancels payment.
 * The home page will show the upgrade prompt as before.
 */
export default function PaymentCancelPage() {
  redirect('/home');
}
