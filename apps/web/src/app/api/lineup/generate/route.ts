import { NextRequest, NextResponse } from 'next/server';

const AI_AGENT_URL = process.env.AI_AGENT_URL || 'http://localhost:8000';
const TIMEOUT_MS = 60_000; // 1 minute

interface LineupGenerateBody {
    game_date?: string;
    season?: string;
}

/**
 * POST /api/lineup/generate — SSE proxy to AI Agent's lineup generator.
 * No auth/credits required for this endpoint (lightweight data operation).
 */
export async function POST(request: NextRequest) {
    try {
        const body: LineupGenerateBody = await request.json().catch(() => ({}));

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const response = await fetch(`${AI_AGENT_URL}/lineup/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...(body.game_date ? { game_date: body.game_date } : {}),
                    season: body.season || '2025-26',
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[API /lineup/generate] AI Agent error:', errorData);
                return NextResponse.json(
                    { error: errorData.detail || 'AI Agent returned an error' },
                    { status: response.status }
                );
            }

            if (!response.body) {
                return NextResponse.json(
                    { error: 'AI Agent returned no response body' },
                    { status: 502 }
                );
            }

            return new Response(response.body, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no',
                },
            });
        } catch (fetchError) {
            clearTimeout(timeoutId);

            if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
                return NextResponse.json(
                    { error: 'Lineup generation timed out. Please try again.' },
                    { status: 504 }
                );
            }

            console.error('[API /lineup/generate] Connection error:', fetchError);
            return NextResponse.json(
                { error: 'AI Agent service is unavailable. Make sure the Python server is running.' },
                { status: 503 }
            );
        }
    } catch (error) {
        console.error('[API /lineup/generate] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
