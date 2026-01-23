'use client';

import { Lock } from 'lucide-react';

export function PremiumFeatureCard() {
  const handleUpgrade = () => {
    // TODO: Implement upgrade logic
    console.log('Upgrade clicked');
  };

  return (
    <div className="relative rounded-xl overflow-hidden bg-brand-dark border border-brand-card-border">
      {/* Circuit board background pattern */}
      <div className="absolute inset-0 opacity-40">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 400 300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Main circuit paths - more complex pattern */}
          <path
            d="M30 60 L120 60 L120 100 L200 100 L200 60 L280 60 L280 100 L360 100"
            stroke="url(#circuitGradient)"
            strokeWidth="2"
            fill="none"
            className="animate-pulse"
          />
          <path
            d="M60 140 L150 140 L150 170 L240 170 L240 140 L330 140"
            stroke="url(#circuitGradient)"
            strokeWidth="1.5"
            fill="none"
            className="animate-pulse"
            style={{ animationDelay: '0.5s' }}
          />
          <path
            d="M90 220 L180 220 L180 250 L270 250"
            stroke="url(#circuitGradient)"
            strokeWidth="1.5"
            fill="none"
            className="animate-pulse"
            style={{ animationDelay: '1s' }}
          />
          
          {/* Circuit nodes (glowing circles) */}
          <circle cx="120" cy="60" r="5" fill="url(#nodeGradient)" className="animate-pulse" />
          <circle cx="200" cy="100" r="5" fill="url(#nodeGradient)" className="animate-pulse" style={{ animationDelay: '0.3s' }} />
          <circle cx="280" cy="60" r="4" fill="url(#nodeGradient)" className="animate-pulse" style={{ animationDelay: '0.6s' }} />
          <circle cx="150" cy="140" r="4" fill="url(#nodeGradient)" className="animate-pulse" style={{ animationDelay: '0.2s' }} />
          <circle cx="240" cy="170" r="4" fill="url(#nodeGradient)" className="animate-pulse" style={{ animationDelay: '0.8s' }} />
          <circle cx="180" cy="220" r="3" fill="url(#nodeGradient)" className="animate-pulse" style={{ animationDelay: '1.2s' }} />
          <circle cx="270" cy="250" r="3" fill="url(#nodeGradient)" className="animate-pulse" style={{ animationDelay: '1.5s' }} />
          
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="circuitGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6EE2F5" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#6EE2F5" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#6EE2F5" stopOpacity="0.5" />
            </linearGradient>
            <radialGradient id="nodeGradient" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#6EE2F5" stopOpacity="1" />
              <stop offset="70%" stopColor="#6EE2F5" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#6EE2F5" stopOpacity="0.2" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 p-8 flex flex-col items-center text-center space-y-6">
        {/* Lock Icon */}
        <div className="relative">
          <Lock
            className="w-16 h-16 text-brand-blue"
            strokeWidth={1.5}
            style={{
              filter: 'drop-shadow(0 0 8px rgba(110, 226, 245, 0.8)) drop-shadow(0 0 15px rgba(110, 226, 245, 0.6))',
            }}
          />
        </div>

        {/* Title */}
        <div>
          <h3
            className="text-2xl font-semibold text-brand-blue mb-3"
            style={{
              textShadow: '0 0 10px rgba(110, 226, 245, 0.8), 0 0 20px rgba(110, 226, 245, 0.5)',
            }}
          >
            Premium Feature
          </h3>
        </div>

        {/* Description */}
        <p className="text-brand-text-light text-base leading-relaxed max-w-xs">
          Unlock AI-Powered One-Click Lineup Selection
        </p>

        {/* Upgrade Button */}
        <button
          onClick={handleUpgrade}
          className="w-full max-w-[280px] py-3 px-6 rounded-lg bg-secondary text-brand-text-light font-medium hover:bg-accent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:ring-offset-brand-dark"
        >
          Upgrade Now - $4.99/mo
        </button>
      </div>
    </div>
  );
}
