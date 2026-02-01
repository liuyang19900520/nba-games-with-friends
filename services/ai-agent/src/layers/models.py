from typing import List, Optional
from pydantic import BaseModel, Field

class PredictionResult(BaseModel):
    """Structured output for the NBA Prediction Agent as per v1.0 standards."""
    winner: str = Field(description="The team predicted to win")
    confidence: float = Field(description="Confidence score from 0.0 to 1.0", ge=0, le=1)
    key_factors: List[str] = Field(description="Core reasons for the prediction")
    detailed_analysis: str = Field(description="Detailed breakdown of the matchup")
