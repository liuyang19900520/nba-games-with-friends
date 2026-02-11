import { redirect } from 'next/navigation';

export default function HomePage() {
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envType = process.env.NODE_ENV;

  // 如果你想调试，可以注释掉 redirect，看页面显示什么
  // return (
  //   <div style={{ color: 'white', padding: '20px' }}>
  //     <h1>Debug Info</h1>
  //     <p>Environment: {envType}</p>
  //     <p>Supabase URL Configured: {hasUrl ? '✅ Yes' : '❌ No'}</p>
  //     <p>Attempting redirect to /lineup...</p>
  //     <a href="/lineup" style={{ color: 'blue' }}>Go to Lineup Manually</a>
  //   </div>
  // );

  redirect('/lineup');
}
