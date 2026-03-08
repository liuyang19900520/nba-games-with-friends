"""
NBA AI Agent - FastAPI Server
Exposes the LangGraph prediction agent via HTTP API with SSE streaming.

Usage:
    python server.py
    # -> Uvicorn running on http://0.0.0.0:8000
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List

from graph.supervisor import create_prediction_graph
from utils.logger import logger

app = FastAPI(title="NBA AI Prediction Agent", version="1.0.0")

# CORS — allow Next.js dev server and production domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://preview.nba-game.liuyang19900520.com",
        "https://nba-game.liuyang19900520.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Schemas ----------


class PredictRequest(BaseModel):
    home_team: str = Field(..., description="Home team name, e.g. 'Lakers'")
    away_team: str = Field(..., description="Away team name, e.g. 'Celtics'")
    game_date: str = Field(..., description="Game date, e.g. '2026-02-12'")


class PredictResponse(BaseModel):
    winner: str
    confidence: float
    key_factors: List[str]
    detailed_analysis: str


# ---------- Endpoints ----------


@app.get("/health")
async def health():
    return {"status": "ok", "service": "nba-ai-agent"}


@app.get("/test")
async def test():
    """Deployment verification endpoint. No external dependencies required."""
    import platform
    from datetime import datetime

    return {
        "status": "ok",
        "service": "nba-ai-agent",
        "environment": os.getenv("ENVIRONMENT", "unknown"),
        "python_version": platform.python_version(),
        "architecture": platform.machine(),
        "timestamp": datetime.now().isoformat(),
        "langchain_project": os.getenv("LANGCHAIN_PROJECT", "not set"),
    }


def _sse_event(event_type: str, data: dict) -> str:
    """Format a Server-Sent Event message."""
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.post("/predict/stream")
async def predict_stream(req: PredictRequest):
    """Stream the Plan-and-Execute prediction via SSE so the frontend can show progress."""
    logger.info(f"[API] Stream predict: {req.home_team} vs {req.away_team} on {req.game_date}")

    def generate():
        try:
            graph = create_prediction_graph()

            user_input = (
                f"Game Date: {req.game_date}\n"
                f"Home Team: {req.home_team}\n"
                f"Away Team: {req.away_team}\n\n"
                "Please analyze this matchup and predict the winner using your tools."
            )

            config = {
                "recursion_limit": 30,
                "configurable": {"thread_id": f"api-{req.game_date}-{req.home_team}-{req.away_team}"},
            }

            step_count = 0
            for chunk in graph.stream({"messages": [user_input]}, config):
                step_count += 1

                if "supervisor" in chunk:
                    next_node = chunk["supervisor"].get("next", "FINISH")
                    yield _sse_event("plan", {
                        "step": step_count,
                        "phase": "planning",
                        "title": f"📋 Supervisor routing task to: {next_node}",
                        "detail": chunk["supervisor"]["messages"][-1].content if chunk["supervisor"].get("messages") else "Finalizing prediction...",
                    })

                elif "data_fetcher" in chunk:
                    last_msg = chunk["data_fetcher"]["messages"][-1]
                    yield _sse_event("execute", {
                        "step": step_count,
                        "phase": "executing",
                        "title": "🔍 Data Fetcher gathering stats & news...",
                        "detail": last_msg.content[:300],
                    })

                elif "reviewer" in chunk:
                    prediction = chunk["reviewer"].get("prediction_result", {})
                    yield _sse_event("result", {
                        "step": step_count,
                        "phase": "complete",
                        "title": "✅ Prediction complete!",
                        "prediction": prediction,
                    })

            # End-of-stream
            yield _sse_event("done", {"message": "Stream complete"})

        except Exception as e:
            logger.error(f"[API] Stream error: {e}", exc_info=True)
            yield _sse_event("error", {"message": str(e)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    """Non-streaming endpoint (kept for backward compatibility)."""
    logger.info(f"[API] Predict request: {req.home_team} vs {req.away_team} on {req.game_date}")

    try:
        graph = create_prediction_graph()

        user_input = (
            f"Game Date: {req.game_date}\n"
            f"Home Team: {req.home_team}\n"
            f"Away Team: {req.away_team}\n\n"
            "Please analyze this matchup and predict the winner using your tools."
        )

        config = {
            "recursion_limit": 30,
            "configurable": {"thread_id": f"api-{req.game_date}-{req.home_team}-{req.away_team}"},
        }

        final_prediction = None
        for chunk in graph.stream({"messages": [user_input]}, config):
            if "reviewer" in chunk:
                final_prediction = chunk["reviewer"].get("prediction_result")

        if not final_prediction:
            raise HTTPException(status_code=500, detail="AI Agent did not produce a prediction result.")

        return PredictResponse(**final_prediction)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] Prediction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


# ---------- 1-Click Lineup ----------


class LineupGenerateRequest(BaseModel):
    game_date: str | None = Field(None, description="Game date (YYYY-MM-DD). If omitted, uses today (JST).")
    season: str = Field("2025-26", description="NBA season")


@app.post("/lineup/generate")
async def lineup_generate(req: LineupGenerateRequest):
    """Generate top-5 fantasy lineup for today's games via SSE."""
    import asyncio
    from tools.lineup_tools import get_today_game_date, get_today_games, get_top_fantasy_players

    logger.info(f"[API] Lineup generate request: date={req.game_date}, season={req.season}")

    async def generate():
        try:
            # Step 1: Determine game date
            game_date = req.game_date or get_today_game_date()
            yield _sse_event("progress", {
                "step": 1,
                "title": "📅 Checking today's schedule...",
                "detail": f"Looking up games for {game_date}",
            })
            await asyncio.sleep(0.3)  # Small delay for UI responsiveness

            # Step 2: Get today's games
            games = get_today_games(game_date, req.season)
            if not games:
                yield _sse_event("error", {
                    "message": f"No games found for {game_date}. Try a different date.",
                })
                return

            yield _sse_event("progress", {
                "step": 2,
                "title": f"🏀 Found {len(games)} games today",
                "detail": f"Analyzing {len(games)} matchups for top performers",
            })
            await asyncio.sleep(0.3)

            # Step 3: Collect team IDs
            team_ids = set()
            for g in games:
                if g.get("home_team_id"):
                    team_ids.add(g["home_team_id"])
                if g.get("away_team_id"):
                    team_ids.add(g["away_team_id"])

            yield _sse_event("progress", {
                "step": 3,
                "title": "📊 Calculating player fantasy scores...",
                "detail": f"Evaluating players from {len(team_ids)} teams",
            })
            await asyncio.sleep(0.3)

            # Step 4: Get top 5 fantasy players
            top_players = get_top_fantasy_players(list(team_ids), limit=5, season=req.season)

            if not top_players:
                yield _sse_event("error", {
                    "message": "No player stats found for today's games.",
                })
                return

            yield _sse_event("progress", {
                "step": 4,
                "title": "🧠 Running prediction model...",
                "detail": "Ranking players by Neural Fantasy Engine",
            })
            await asyncio.sleep(0.5)

            # Step 5: Return result
            yield _sse_event("result", {
                "step": 5,
                "title": "✅ Lineup generated!",
                "game_date": game_date,
                "players": top_players,
            })

            yield _sse_event("done", {"message": "Stream complete"})

        except Exception as e:
            logger.error(f"[API] Lineup generate error: {e}", exc_info=True)
            yield _sse_event("error", {"message": str(e)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------- Entry point ----------

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AI_AGENT_PORT", "8000"))
    logger.info(f"[API] Starting NBA AI Agent server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
