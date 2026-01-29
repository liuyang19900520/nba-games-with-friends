import os
import sys
from dotenv import load_dotenv

# Add src to path so we can import modules
sys.path.append(os.path.join(os.getcwd(), "src"))

from graph.predictor import create_prediction_graph
from langchain_core.messages import HumanMessage

def run_prediction(date: str, home_team: str, away_team: str):
    load_dotenv()
    
    config = {"configurable": {"thread_id": "nba_prediction_test"}}
    
    # Construct a structured prompt for the AI
    user_input = (
        f"Game Date: {date}\n"
        f"Home Team: {home_team}\n"
        f"Away Team: {away_team}\n\n"
        "Please analyze this matchup and predict the winner using your tools."
    )

    print(f"\n--- [NBA AI PREDICTOR] ---")
    print(f"Target: {home_team} vs {away_team} on {date}")
    print("--------------------------")

    graph = create_prediction_graph()
    
    for chunk in graph.stream(
        {"messages": [HumanMessage(content=user_input)]}, 
        config
    ):
        # LangGraph nodes output their results here
        if "nba_analyst" in chunk:
            msg = chunk["nba_analyst"]["messages"][-1]
            # If the AI has content, it's its "Thought" or "Final Answer"
            if msg.content:
                if msg.tool_calls:
                    print(f"\n[AI Thought]:\n{msg.content}")
                else:
                    print(f"\n[Final Prediction Result]:\n{msg.content}")
        elif "tools" in chunk:
            for msg in chunk["tools"]["messages"]:
                print(f"\n[Tool Observation - {msg.name}]:\n{msg.content}")

if __name__ == "__main__":
    # Default values for testing if no arguments provided
    target_date = "2024-02-08"
    home = "Cleveland Cavaliers"
    away = "Golden State Warriors"

    # Allow CLI arguments: python run_test.py 2024-02-08 "Lakers" "Celtics"
    if len(sys.argv) >= 4:
        target_date = sys.argv[1]
        home = sys.argv[2]
        away = sys.argv[3]
    
    run_prediction(target_date, home, away)
