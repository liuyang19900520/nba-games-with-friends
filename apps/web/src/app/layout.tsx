import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { BottomNav } from '@/components/layout/BottomNav';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'NBA Fantasy Manager',
  description: 'Manage your NBA fantasy team with real-time stats and analytics',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={inter.variable}>
      <body className="font-sans antialiased">
        <div className="max-w-md mx-auto min-h-screen bg-background text-foreground flex flex-col">
          <main className="flex-1 overflow-y-auto pb-[90px]">
            {children}
          </main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
