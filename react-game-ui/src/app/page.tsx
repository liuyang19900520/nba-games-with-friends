import { redirect } from 'next/navigation';

// 重定向到 lineup 页面（与原来的 React Router 行为一致）
export default function HomePage() {
  redirect('/lineup');
}
