import { redirect } from 'next/navigation';

// Redirect to the lineup page (Consistent with original React Router behavior)
export default function HomePage() {
  redirect('/lineup');
}
