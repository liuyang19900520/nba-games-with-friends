import { redirect } from 'next/navigation';

// Root redirect to lineup - Optimized for Next.js 15 on Vercel
export const dynamic = "force-dynamic";

export default function HomePage() {
  redirect('/lineup');
}
