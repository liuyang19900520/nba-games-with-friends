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

from graph.plan_and_execute import create_prediction_graph
from utils.logger import logger

app = FastAPI(title="NBA AI Prediction Agent", version="1.0.0")

# CORS — allow Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
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
            for chunk in graph.stream({"input": user_input}, config):
                step_count += 1

                if "planner" in chunk:
                    steps = chunk["planner"].get("plan", [])
                    yield _sse_event("plan", {
                        "step": step_count,
                        "phase": "planning",
                        "title": "📋 Analyzing matchup & creating plan...",
                        "detail": steps,
                    })

                elif "execute" in chunk:
                    past = chunk["execute"].get("past_steps", [])
                    if past:
                        task, result = past[-1]
                        yield _sse_event("execute", {
                            "step": step_count,
                            "phase": "executing",
                            "title": f"🔍 {task}",
                            "detail": result[:300] if isinstance(result, str) else str(result)[:300],
                        })

                elif "replanner" in chunk:
                    data = chunk["replanner"]
                    if "response" in data:
                        yield _sse_event("replan", {
                            "step": step_count,
                            "phase": "concluding",
                            "title": "🧠 Forming preliminary conclusion...",
                            "detail": data["response"][:300] if isinstance(data["response"], str) else "",
                        })
                    else:
                        new_plan = data.get("plan", [])
                        yield _sse_event("replan", {
                            "step": step_count,
                            "phase": "replanning",
                            "title": "🔄 Adjusting analysis plan...",
                            "detail": new_plan,
                        })

                elif "synthesizer" in chunk:
                    prediction = chunk["synthesizer"].get("prediction_result", {})
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
        for chunk in graph.stream({"input": user_input}, config):
            if "synthesizer" in chunk:
                final_prediction = chunk["synthesizer"].get("prediction_result")

        if not final_prediction:
            raise HTTPException(status_code=500, detail="AI Agent did not produce a prediction result.")

        return PredictResponse(**final_prediction)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] Prediction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


# ---------- Entry point ----------

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AI_AGENT_PORT", "8000"))
    logger.info(f"[API] Starting NBA AI Agent server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
