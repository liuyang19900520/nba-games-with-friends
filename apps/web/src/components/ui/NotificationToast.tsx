'use client';

import { useEffect, useState } from 'react';
import { Sparkles, CheckCircle, X } from 'lucide-react';

interface NotificationToastProps {
    isVisible: boolean;
    message: string;
    onClose: () => void;
    type?: 'success' | 'info';
    duration?: number;
}

export function NotificationToast({
    isVisible,
    message,
    onClose,
    type = 'success',
    duration = 4000
}: NotificationToastProps) {
    const [show, setShow] = useState(false);

    // Handle entry animation
    useEffect(() => {
        if (isVisible) {
            setShow(true);
            const timer = setTimeout(() => {
                handleClose();
            }, duration);
            return () => clearTimeout(timer);
        } else {
            setShow(false);
        }
    }, [isVisible, duration]);

    const handleClose = () => {
        setShow(false);
        // Wait for exit animation to finish before calling onClose
        setTimeout(onClose, 300);
    };

    if (!isVisible && !show) return null;

    return (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4 pointer-events-none">
            <div
                className={`
          pointer-events-auto
          relative flex items-center gap-3 p-4 rounded-xl 
          bg-brand-dark/95 border border-brand-blue/30 
          shadow-[0_0_20px_rgba(110,226,245,0.4)] backdrop-blur-md
          transition-all duration-300 transform
          ${show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-4 opacity-0 scale-95'}
        `}
            >
                {/* Glow Element */}
                <div className="absolute inset-0 rounded-xl bg-blend-overlay opacity-20 bg-gradient-to-r from-brand-blue/20 to-transparent pointer-events-none" />

                {/* Icon */}
                <div className="shrink-0 relative">
                    <div className="absolute inset-0 bg-brand-blue/20 blur-lg rounded-full" />
                    {type === 'success' ? (
                        <Sparkles className="w-6 h-6 text-brand-blue relative z-10" strokeWidth={1.5} />
                    ) : (
                        <CheckCircle className="w-6 h-6 text-brand-blue relative z-10" />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-brand-blue mb-0.5">Notification</h4>
                    <p className="text-sm text-brand-text-light leading-snug">
                        {message}
                    </p>
                </div>

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="shrink-0 p-1 rounded-full text-brand-text-dim hover:text-white hover:bg-white/10 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
