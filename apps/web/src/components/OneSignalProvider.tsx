'use client';

import { useEffect, useState } from 'react';

export function OneSignalProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initOneSignal = async () => {
      if (typeof window === 'undefined') return;
      if (isInitialized) return;

      const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
      if (!appId) {
        console.warn('OneSignal App ID not configured');
        return;
      }

      try {
        const OneSignal = (await import('react-onesignal')).default;

        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: {
            enable: true,
            size: 'small',
            position: 'bottom-right',
          },
          promptOptions: {
            slidedown: {
              prompts: [
                {
                  type: 'push',
                  autoPrompt: true,
                  text: {
                    actionMessage: '订阅比赛通知，第一时间获取比赛结果',
                    acceptButton: '允许',
                    cancelButton: '稍后',
                  },
                  delay: {
                    pageViews: 1,
                    timeDelay: 5,
                  },
                },
              ],
            },
          },
        });

        setIsInitialized(true);
        console.log('OneSignal initialized successfully');
      } catch (error) {
        console.error('OneSignal initialization failed:', error);
      }
    };

    initOneSignal();
  }, [isInitialized]);

  return <>{children}</>;
}
