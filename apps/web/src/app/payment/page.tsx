'use client';

import { Header } from '@/components/layout/Header';
import { PremiumFeatureCard } from '@/components/features/home/PremiumFeatureCard';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function PaymentPage() {
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        async function getUser() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setUserId(user.id);
                } else {
                    router.push('/login?redirect=/payment');
                }
            } catch (err) {
                console.error('Auth error:', err);
            } finally {
                setLoading(false);
            }
        }
        getUser();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-brand-dark flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-brand-dark">
            <Header title="Top Up Credits" showBack />

            <div className="pt-24 px-4 pb-8 max-w-md mx-auto space-y-8">
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-white">Need More Credits?</h2>
                    <p className="text-brand-text-dim text-sm px-4">
                        You&apos;ve used all your AI credits. Top up now to continue using our premium AI features.
                    </p>
                </div>

                <div className="px-2">
                    <PremiumFeatureCard userId={userId} />
                </div>

                <div className="mx-2 p-5 rounded-2xl bg-brand-blue/5 border border-brand-blue/10 backdrop-blur-md">
                    <h3 className="text-xs font-bold text-brand-blue mb-3 uppercase tracking-widest opacity-80">Premium Benefits</h3>
                    <ul className="space-y-3">
                        <li className="flex items-start gap-3 text-sm text-brand-text-dim">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shadow-[0_0_8px_#6EE2F5]" />
                            <span>Unlock complex neural game predictions</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-brand-text-dim">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shadow-[0_0_8px_#6EE2F5]" />
                            <span>Optimized fantasy lineups generator</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-brand-text-dim">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shadow-[0_0_8px_#6EE2F5]" />
                            <span>Real-time data analysis from multiple APIs</span>
                        </li>
                    </ul>
                </div>

                <div className="text-center pb-8">
                    <button
                        onClick={() => router.back()}
                        className="text-sm font-medium text-brand-text-dim hover:text-white transition-all hover:scale-105 active:scale-95"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        </main>
    );
}
