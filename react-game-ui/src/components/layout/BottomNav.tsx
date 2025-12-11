import { Home, Trophy, Users, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/leagues', icon: Trophy, label: 'Leagues' },
  { path: '/lineup', icon: null, label: 'Lineup', isCenter: true },
  { path: '/matchups', icon: Users, label: 'Matchups' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-[90px] bottom-nav-bg shadow-glow-nav z-50">
      <div className="flex justify-around items-center h-full pt-2">
        {navItems.map((item) => {
          if (item.isCenter) {
            // Special center button with basketball icon
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center w-20 relative ${
                  isActive(item.path) ? '-mt-6 text-brand-blue' : 'text-brand-text-dim'
                }`}
                aria-label={item.label}
              >
                {/* Glowing halo effect - only when active */}
                {isActive(item.path) && (
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full opacity-60 blur-xl"
                    style={{
                      background: 'radial-gradient(circle, rgba(110, 226, 245, 0.8) 0%, rgba(245, 166, 35, 0.6) 100%)',
                    }}
                  />
                )}
                
                <div
                  className={`flex items-center justify-center relative transition-all duration-300 mb-1 ${
                    isActive(item.path)
                      ? 'w-16 h-16 rounded-full bg-gradient-to-br from-brand-blue to-brand-orange shadow-[0_8px_20px_rgba(110,226,245,0.5),0_4px_10px_rgba(245,166,35,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)] transform translate-y-[-4px]'
                      : 'w-6 h-6'
                  }`}
                >
                  <div
                    className={`${
                      isActive(item.path) ? 'w-[60px] h-[60px]' : 'w-6 h-6'
                    } rounded-full flex items-center justify-center transition-all duration-300 ${
                      isActive(item.path)
                        ? 'bg-brand-dark shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]'
                        : 'bg-transparent'
                    }`}
                  >
                    <svg
                      className={`${isActive(item.path) ? 'w-8 h-8' : 'w-6 h-6'}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isActive(item.path) ? '#6EE2F5' : '#7A8B99'}
                      strokeWidth="1.5"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                    </svg>
                  </div>
                </div>
                {/* Label text - always visible, aligned with other buttons */}
                <span className={`text-xs ${isActive(item.path) ? 'text-brand-blue' : 'text-brand-text-dim'}`}>
                  {item.label}
                </span>
              </button>
            );
          }

          const Icon = item.icon!;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 w-16 ${
                isActive(item.path) ? 'text-brand-blue' : 'text-brand-text-dim'
              }`}
              aria-label={item.label}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

