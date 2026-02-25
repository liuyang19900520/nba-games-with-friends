import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/auth/supabase';

const AI_AGENT_URL = process.env.AI_AGENT_URL || 'http://localhost:8000';
const TIMEOUT_MS = 120_000; // 2 minutes

interface PredictRequestBody {
    home_team: string;
    away_team: string;
    game_date: string;
}

/**
 * POST /api/predict — Streaming SSE proxy to the Python AI Agent.
 * Requires authentication and consumes 1 AI credit per request.
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Authenticate user via Supabase session
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Authentication required. Please log in.', code: 'AUTH_REQUIRED' },
                { status: 401 }
            );
        }

        // 2. Atomically decrement credit
        const { data: remainingCredits, error: rpcError } = await supabase
            .rpc('decrement_ai_credit', { p_user_id: user.id });

        if (rpcError) {
            console.error('[API /predict] Credit decrement RPC error:', rpcError);
            return NextResponse.json(
                { error: 'Failed to verify credits. Please try again.', code: 'CREDIT_ERROR' },
                { status: 500 }
            );
        }

        if (remainingCredits === -1) {
            return NextResponse.json(
                { error: 'No AI credits remaining. Purchase more credits to continue.', code: 'NO_CREDITS' },
                { status: 403 }
            );
        }

        // 3. Parse and validate request body
        const body: PredictRequestBody = await request.json();

        if (!body.home_team || !body.away_team || !body.game_date) {
            // Best-effort refund since validation failed before calling AI agent
            await supabase
                .from('users')
                .update({ ai_credits_remaining: remainingCredits + 1 })
                .eq('id', user.id);

            return NextResponse.json(
                { error: 'Missing required fields: home_team, away_team, game_date' },
                { status: 400 }
            );
        }

        // Helper: best-effort refund credit on AI failure
        const refundCredit = async () => {
            await supabase
                .from('users')
                .update({ ai_credits_remaining: remainingCredits + 1 })
                .eq('id', user.id)
                .then(({ error }) => {
                    if (error) console.error('[API /predict] Credit refund failed:', error);
                });
        };

        // 4. Proxy to AI agent
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const response = await fetch(`${AI_AGENT_URL}/predict/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[API /predict] AI Agent error:', errorData);
                await refundCredit();
                return NextResponse.json(
                    { error: errorData.detail || 'AI Agent returned an error' },
                    { status: response.status }
                );
            }

            if (!response.body) {
                await refundCredit();
                return NextResponse.json(
                    { error: 'AI Agent returned no response body' },
                    { status: 502 }
                );
            }

            // Include remaining credits in response header for frontend
            return new Response(response.body, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no',
                    'X-Credits-Remaining': String(remainingCredits),
                },
            });
        } catch (fetchError) {
            clearTimeout(timeoutId);
            await refundCredit();

            if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
                return NextResponse.json(
                    { error: 'AI prediction timed out. Please try again.' },
                    { status: 504 }
                );
            }

            console.error('[API /predict] Connection error:', fetchError);
            return NextResponse.json(
                { error: 'AI Agent service is unavailable. Make sure the Python server is running.' },
                { status: 503 }
            );
        }
    } catch (error) {
        console.error('[API /predict] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
