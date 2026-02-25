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
            prenotify: true,
            showCredit: false,
            text: {
              'tip.state.unsubscribed': '订阅通知',
              'tip.state.subscribed': '您已订阅通知',
              'tip.state.blocked': '您已屏蔽通知',
              'message.prenotify': '点击订阅通知',
              'message.action.subscribing': '正在订阅...',
              'message.action.subscribed': '感谢订阅！',
              'message.action.resubscribed': '您已重新订阅通知',
              'message.action.unsubscribed': '您已取消订阅通知',
              'dialog.main.title': '管理通知',
              'dialog.main.button.subscribe': '订阅',
              'dialog.main.button.unsubscribe': '取消订阅',
              'dialog.blocked.title': '解除通知屏蔽',
              'dialog.blocked.message': '按照这些说明解除屏蔽：'
            }
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
