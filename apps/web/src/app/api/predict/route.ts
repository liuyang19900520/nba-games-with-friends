import { NextRequest, NextResponse } from 'next/server';

const AI_AGENT_URL = process.env.AI_AGENT_URL || 'http://localhost:8000';
const TIMEOUT_MS = 120_000; // 2 minutes

interface PredictRequestBody {
    home_team: string;
    away_team: string;
    game_date: string;
}

/**
 * POST /api/predict — Streaming SSE proxy to the Python AI Agent.
 * Forwards the SSE stream from Python FastAPI → browser.
 */
export async function POST(request: NextRequest) {
    try {
        const body: PredictRequestBody = await request.json();

        if (!body.home_team || !body.away_team || !body.game_date) {
            return NextResponse.json(
                { error: 'Missing required fields: home_team, away_team, game_date' },
                { status: 400 }
            );
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            // Call the streaming endpoint
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
                return NextResponse.json(
                    { error: errorData.detail || 'AI Agent returned an error' },
                    { status: response.status }
                );
            }

            // Passthrough the SSE stream
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
