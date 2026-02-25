import json
import os

from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent
from tools import tools
from models.planner import PlanExecuteState, Plan, Act
from layers.models import PredictionResult
from utils.logger import logger


def create_prediction_graph():
    """
    Build the NBA prediction graph using a Plan-and-Execute architecture.
    Contains Planner → Executor → Replanner loop, plus a final Synthesizer node.
    """
    llm = ChatOpenAI(
        model="deepseek-chat",
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        base_url="https://api.deepseek.com",
        streaming=True,
    )

    # Non-streaming LLM for structured output (streaming + json_mode can conflict)
    structured_llm = ChatOpenAI(
        model="deepseek-chat",
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        base_url="https://api.deepseek.com",
        streaming=False,
    )

    # Internal Executor: a prebuilt ReAct Agent that executes individual steps
    executor = create_react_agent(llm, tools)

    # --- Node Definitions ---

    def plan_step(state: PlanExecuteState):
        """Planner node: creates an initial plan based on user input."""

        # 0. Dynamically get tool descriptions
        tool_descriptions = "\n".join(
            [f"- {t.name}: {t.description}" for t in tools]
        )

        # 1. Few-Shot Examples — anchor the reasoning style
        few_shot_examples = """
Example 1:
User: "Analyze the Warriors' recent performance — their win rate over the last 5 games and Curry's average points."
Plan:
{
  "reasoning": "The user wants to understand the Warriors' recent form. This involves two specific metrics: last 5 games win rate and Curry's scoring average. I need to first fetch the Warriors' recent game data to calculate win rate, then get Curry's individual stats for those games.",
  "steps": [
    "Fetch the Golden State Warriors' last 5 game results with scores and outcomes.",
    "Calculate the Warriors' win rate based on those 5 games.",
    "Fetch Stephen Curry's individual stats for those 5 games.",
    "Calculate Curry's average points per game over those 5 games.",
    "Summarize the Warriors' recent performance with both metrics."
  ]
}

Example 2:
User: "Predict the outcome of tomorrow's Lakers vs Celtics game."
Plan:
{
  "reasoning": "This is a prediction task requiring comprehensive data collection. I need both teams' fundamentals (record, efficiency), latest news from the vector database, injury reports, recent performance trends, schedule stress, and head-to-head history. Let me systematically gather all this information.",
  "steps": [
    "Use get_team_id_by_code to get the Team IDs for Lakers (LAL) and Celtics (BOS).",
    "Use get_team_fundamentals to get both teams' records, offensive/defensive efficiency, and home/away splits.",
    "Use query_vector_memory to search the vector database for latest news and expert analysis on Lakers and Celtics.",
    "Use search_nba_injuries to check both teams' latest injury reports and confirm key player availability.",
    "Use get_recent_performance_analysis to analyze both teams' scoring trends and win rate over the last 5 games.",
    "Use get_star_player_trends to compare each team's star players' recent form vs season averages.",
    "Use get_schedule_stress_analysis to check if either team has back-to-backs or a compressed schedule.",
    "Use get_matchup_analysis to get head-to-head records and efficiency comparisons.",
    "Synthesize all collected data, analyze strengths and weaknesses, and make a prediction."
  ]
}

Example 3:
User: "Compare the Lakers and Celtics — who has more championships, and what was the score of their last meeting?"
Plan:
{
  "reasoning": "This is a comparison task with two types of data: historical (championship count) and recent (last meeting score). These likely come from different sources, so it's best to query them separately.",
  "steps": [
    "Look up the total number of NBA championships for the Los Angeles Lakers.",
    "Look up the total number of NBA championships for the Boston Celtics.",
    "Find the date and final score of the most recent Lakers vs Celtics game.",
    "Compare championship counts and combine with the latest matchup result to generate a response."
  ]
}
"""

        planner_prompt = (
            "You are a top-tier NBA analysis expert Agent.\n"
            "Your core ability is to decompose a user's question into a series of executable, logically rigorous steps.\n\n"
            f"Available tools:\n{tool_descriptions}\n\n"
            "**Important Tool Notes**:\n"
            "- `query_vector_memory`: Searches the vector database for latest NBA news and analysis articles (auto-scraped from ESPN every 30 minutes). For prediction tasks, always use this tool to get the latest intelligence.\n"
            "- `search_nba_injuries`: Specifically searches NBA injury reports to confirm key player availability. Injury information is critical for predictions.\n\n"
            "Planning principles:\n"
            "1. **Be specific and detailed**: Don't say 'get data' — say 'get the Warriors' scoring data from the last 5 games'.\n"
            "2. **Handle dependencies**: If step B depends on step A's results (e.g., you need a Player ID before querying stats), ensure correct ordering.\n"
            "3. **Include reasoning**: Before listing steps, explain your thought process in the reasoning field.\n"
            "4. **Be comprehensive for predictions**: If this is a game prediction, the plan MUST include: team fundamentals, vector DB latest news, injury reports, recent performance, schedule stress, and head-to-head history.\n\n"
            f"Reference these high-quality examples:\n{few_shot_examples}\n\n"
            "You MUST return pure JSON with no additional text or markdown. JSON structure:\n"
            '{"reasoning": "Your reasoning process...", "steps": ["Step 1", "Step 2", ...]}'
        )

        planner = structured_llm.with_structured_output(Plan, method="json_mode")

        plan_result = planner.invoke([
            {"role": "system", "content": planner_prompt},
            {"role": "user", "content": state["input"]},
        ])

        return {"plan": plan_result.steps, "reasoning": plan_result.reasoning}

    def execute_step(state: PlanExecuteState):
        """Executor node: executes the first step in the current plan."""
        plan = state["plan"]
        task = plan[0]
        context = (
            f"You are currently executing this step from the plan: {task}\n\n"
            f"The goal is to solve the original task: {state['input']}\n\n"
            f"Use the available tools to complete this specific step and return detailed results."
        )

        result = executor.invoke({"messages": [("user", context)]})
        return {"past_steps": [(task, result["messages"][-1].content)]}

    def replan_step(state: PlanExecuteState):
        """Replanner node: decides whether to continue or finish based on execution results."""
        replanner_prompt = (
            "You are a top-tier NBA analysis expert. Based on the execution results so far, decide what to do next.\n"
            "If you have enough evidence to answer the question, provide a final answer (set response to a string).\n"
            "If you need more steps, update the plan list (set response to a list of strings) — remove completed steps and add any necessary follow-ups.\n\n"
            "You MUST return pure JSON with no additional text or markdown. JSON structure:\n"
            'When task is complete: {"response": "Your final answer..."}\n'
            'When more steps are needed: {"response": ["Next step 1", "Next step 2", ...]}'
        )
        replanner = structured_llm.with_structured_output(Act, method="json_mode")

        history = "\n".join(
            f"Step: {k}\nResult: {v}" for k, v in state["past_steps"]
        )
        user_msg = f"Original goal: {state['input']}\n\nExecution history:\n{history}"

        result = replanner.invoke([
            {"role": "system", "content": replanner_prompt},
            {"role": "user", "content": user_msg},
        ])

        if isinstance(result.response, str):
            return {"response": result.response}
        else:
            return {"plan": result.response}

    def synthesize_prediction(state: PlanExecuteState):
        """Synthesizer node: combines all collected data into a structured PredictionResult."""
        history = "\n".join(
            f"Step: {k}\nResult: {v}" for k, v in state["past_steps"]
        )

        synthesizer_prompt = (
            "You are an NBA game prediction expert. Based on all the data collected below, generate a structured prediction result.\n\n"
            "Requirements:\n"
            "1. winner: Full name of the predicted winning team\n"
            "2. confidence: Prediction confidence (0.0 to 1.0), based on data completeness and consistency\n"
            "3. key_factors: 3-5 key factors influencing the prediction\n"
            "4. detailed_analysis: A detailed English analysis covering offensive/defensive matchups, injury impact, recent form, schedule factors, etc.\n\n"
            f"Original task: {state['input']}\n\n"
            f"Replanner preliminary conclusion:\n{state.get('response', '')}\n\n"
            f"Full execution history:\n{history}\n\n"
            "You MUST return pure JSON with no additional text or markdown. JSON structure:\n"
            '{"winner": "Full Team Name", "confidence": 0.75, "key_factors": ["Factor 1", "Factor 2"], "detailed_analysis": "Detailed analysis..."}'
        )

        synthesizer = structured_llm.with_structured_output(PredictionResult, method="json_mode")

        prediction = synthesizer.invoke([
            {"role": "system", "content": synthesizer_prompt},
            {"role": "user", "content": "Based on all the data above, generate the structured prediction result."},
        ])

        return {"prediction_result": prediction.model_dump()}

    # --- Routing Logic ---

    def should_continue(state: PlanExecuteState):
        if "response" in state and state["response"]:
            return "synthesizer"
        return "execute"

    # --- Build Graph (StateGraph) ---

    workflow = StateGraph(PlanExecuteState)

    workflow.add_node("planner", plan_step)
    workflow.add_node("execute", execute_step)
    workflow.add_node("replanner", replan_step)
    workflow.add_node("synthesizer", synthesize_prediction)

    workflow.set_entry_point("planner")
    workflow.add_edge("planner", "execute")
    workflow.add_edge("execute", "replanner")
    workflow.add_conditional_edges(
        "replanner",
        should_continue,
        {"execute": "execute", "synthesizer": "synthesizer"},
    )
    workflow.add_edge("synthesizer", END)

    return workflow.compile()
