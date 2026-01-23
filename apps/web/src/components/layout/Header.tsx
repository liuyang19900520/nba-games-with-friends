'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function Header({
  title,
  showBack = false,
  onBack,
}: HeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 max-w-md mx-auto z-50 bg-brand-dark/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 h-[60px]">
        {/* Back Button */}
        {showBack ? (
          <button onClick={handleBack} className="p-2" aria-label="Back">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
        ) : (
          <div className="w-10" />
        )}

        {/* Page Title */}
        <h1 className="text-base font-semibold text-white flex-1 text-center px-2 truncate">
          {title}
        </h1>

        {/* Right side spacer (no buttons) */}
        <div className="w-10" />
      </div>
    </header>
  );
}

