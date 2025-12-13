import { ArrowLeft, Settings, Search, Share2, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  showSettings?: boolean;
  showSearch?: boolean;
  showShare?: boolean;
  showMore?: boolean;
  rightActions?: ReactNode; // Custom right side actions
  onBack?: () => void;
  onSettings?: () => void;
  onSearch?: () => void;
  onShare?: () => void;
  onMore?: () => void;
}

export function Header({
  title,
  showBack = false,
  showSettings = false,
  showSearch = false,
  showShare = false,
  showMore = false,
  rightActions,
  onBack,
  onSettings,
  onSearch,
  onShare,
  onMore,
}: HeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  // Build right side actions
  const rightButtons: ReactNode[] = [];

  if (showShare) {
    rightButtons.push(
      <button key="share" onClick={onShare} className="p-2" aria-label="Share">
        <Share2 className="w-5 h-5 text-white" />
      </button>
    );
  }

  if (showMore) {
    rightButtons.push(
      <button key="more" onClick={onMore} className="p-2" aria-label="More">
        <MoreVertical className="w-5 h-5 text-white" />
      </button>
    );
  }

  if (showSearch) {
    rightButtons.push(
      <button key="search" onClick={onSearch} className="p-2" aria-label="Search">
        <Search className="w-6 h-6 text-white" />
      </button>
    );
  }

  if (showSettings) {
    rightButtons.push(
      <button key="settings" onClick={onSettings} className="p-2" aria-label="Settings">
        <Settings className="w-6 h-6 text-white" />
      </button>
    );
  }

  // Use custom right actions if provided, otherwise use buttons
  const rightContent = rightActions || (
    rightButtons.length > 0 ? (
      <div className="flex items-center gap-2">{rightButtons}</div>
    ) : (
      <div className="w-10" />
    )
  );

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

        {/* Right Actions */}
        {rightContent}
      </div>
    </header>
  );
}

