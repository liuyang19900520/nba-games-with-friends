import { ArrowLeft, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  showSettings?: boolean;
  onBack?: () => void;
}

export function Header({ title, showBack = false, showSettings = false, onBack }: HeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 max-w-md mx-auto z-50 bg-brand-dark/80 backdrop-blur-sm">
      <div className="flex items-center justify-between p-4 h-[60px]">
        {/* Back Button */}
        {showBack ? (
          <button onClick={handleBack} className="p-2" aria-label="Back">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
        ) : (
          <div className="w-10" />
        )}

        {/* Page Title */}
        <h1 className="text-lg font-semibold text-white">{title}</h1>

        {/* Settings Button */}
        {showSettings ? (
          <button className="p-2" aria-label="Settings">
            <Settings className="w-6 h-6 text-white" />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>
    </header>
  );
}

