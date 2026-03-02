"""
Multi-Agent Supervisor Architecture for NBA Predictions
Replaces the monolithic `plan_and_execute.py` with specialized agents communicating via a Supervisor routing node.
"""
import os
from typing import TypedDict, Annotated, Sequence, Any
import operator
import json

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent
from tools import tools
from pydantic import BaseModel, Field

# --- Define State ---

class AgentState(TypedDict):
    """The central state of the graph, holding messages, the active agent, and the final result."""
    messages: Annotated[Sequence[BaseMessage], operator.add]
    next: str  # Which sub-agent should act next
    prediction_result: dict
    
# --- Define the Supervisor Router Model ---

class RouterDecision(BaseModel):
    next_agent: str = Field(description="The next specialized agent to call: 'data_fetcher', 'reviewer', or 'FINISH'")
    instructions: str = Field(description="Instructions for the next agent")

# --- Initialize LLMs ---

def get_llm(streaming=False):
    return ChatOpenAI(
        model="deepseek-chat",
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        base_url="https://api.deepseek.com",
        streaming=streaming,
    )

# --- Define Sub-Agents ---

def create_data_fetcher():
    """An agent purely focused on using tools to fetch hard numbers and news."""
    prompt = SystemMessage(content=(
        "You are the Data Fetcher Agent. Your ONLY job is to execute the available tools (like get_team_fundamentals, "
        "query_vector_memory, search_nba_injuries) to retrieve accurate data requested by the Supervisor. \n"
        "You MUST use tools to retrieve this data. Do not say you need more steps or apologize. Just use the tools and "
        "summarize the data you retrieved in your final response to the Supervisor."
    ))
    return create_react_agent(get_llm(), tools, prompt=prompt)

def create_reviewer():
    """An agent purely focused on evaluating the returned data and building a prediction."""
    prompt = SystemMessage(content=(
        "You are the Reviewer & Prediction Agent. You review the raw data fetched by the Data Fetcher, "
        "and generate a final analysis and prediction. \n"
        "You do not execute tools. You only reason and format the final prediction."
    ))
    # Reviewer doesn't need data-fetching tools normally, but we can give it a math/calc tool if needed
    return create_react_agent(get_llm(), tools=[], prompt=prompt)

# --- SuperVisor Node ---

def supervisor_node(state: AgentState):
    """The central coordinator that decides what happens next."""
    supervisor_prompt = (
        "You are a Supervisor coordinating an NBA Prediction task.\n"
        "Your workers are:\n"
        "- 'data_fetcher': Executes tools to gather stats, news, and injuries.\n"
        "- 'reviewer': Evaluates the raw data and generates the final prediction result.\n\n"
        "Review the conversation history and decide who should act next.\n"
        "CRITICAL RULE: Do NOT ask the 'data_fetcher' to get all data at once. Ask it to fetch ONE specific piece of information at a time (e.g., 'Only fetch Lakers stats', or 'Only fetch Celtics injuries').\n"
        "If you are missing data (fundamentals, injuries, news for both teams), route to 'data_fetcher' with ONE specific instruction.\n"
        "If the data_fetcher has provided enough info for both teams, route to 'reviewer'.\n"
        "If you are stuck in a loop and the data_fetcher keeps failing or asking for more steps, route to 'reviewer'.\n"
        "If the reviewer has provided the final valid prediction, return 'FINISH'.\n"
        "You MUST return pure JSON with no additional text or markdown. JSON structure:\n"
        '{"next_agent": "...", "instructions": "..."}'
    )
    
    # We use a structured LLM to guarantee it picks a valid next step
    router_llm = get_llm(streaming=False).with_structured_output(RouterDecision, method="json_mode")
    
    messages = [SystemMessage(content=supervisor_prompt)] + list(state["messages"])
    decision = router_llm.invoke(messages)
    
    if decision.next_agent == "FINISH":
        return {"next": "FINISH"}
        
    # Append the supervisor's instructions to guide the next worker
    return {
        "next": decision.next_agent,
        "messages": [AIMessage(content=f"Supervisor instructions: {decision.instructions}")]
    }

# --- Format Final Result ---

from layers.models import PredictionResult

def extract_final_prediction(state: AgentState):
    """A purely deterministic node that extracts the JSON from the reviewer's output."""
    # We ask a lightweight model to extract the structured JSON from the Reviewer's final string
    extractor_llm = get_llm(streaming=False).with_structured_output(PredictionResult, method="json_mode")
    final_output = extractor_llm.invoke([
        SystemMessage(content=(
            "Extract the final prediction strictly into this schema. "
            "You MUST return pure JSON with no additional text or markdown. JSON structure:\n"
            '{"winner": "Full Team Name", "confidence": 0.75, "key_factors": ["Factor 1", "Factor 2"], "detailed_analysis": "Detailed analysis..."}'
        )),
        state["messages"][-1]
    ])
    return {"prediction_result": final_output.model_dump()}

# --- Sub-Agent Invocation Wrappers ---

def data_fetcher_node(state: AgentState, data_agent):
    result = data_agent.invoke(state, config={"recursion_limit": 30})
    last_msg = result["messages"][-1]
    # Mark the message so the supervisor knows who it came from
    return {"messages": [AIMessage(content=f"[DataFetcher]: {last_msg.content}")], "next": ""}

def reviewer_node(state: AgentState, reviewer_agent):
    result = reviewer_agent.invoke(state, config={"recursion_limit": 30})
    last_msg = result["messages"][-1]
    return {"messages": [AIMessage(content=f"[Reviewer]: {last_msg.content}")], "next": ""}

# --- Build the Multi-Agent Graph ---

def create_prediction_graph():
    """Creates the modern Supervisor architecture graph."""
    workflow = StateGraph(AgentState)
    
    # Initialize agents
    d_fetcher = create_data_fetcher()
    r_viewer = create_reviewer()
    
    # Add Nodes
    workflow.add_node("supervisor", supervisor_node)
    
    # Provide the actual agents using lambda or partials
    workflow.add_node("data_fetcher", lambda state: data_fetcher_node(state, d_fetcher))
    workflow.add_node("reviewer", lambda state: reviewer_node(state, r_viewer))
    workflow.add_node("finalizer", extract_final_prediction)
    
    # Routing Logic
    workflow.set_entry_point("supervisor")
    
    # We add conditional edges from Supervisor to the agents
    workflow.add_conditional_edges(
        "supervisor",
        lambda x: x["next"],
        {
            "data_fetcher": "data_fetcher",
            "reviewer": "reviewer",
            "FINISH": "finalizer"
        }
    )
    
    # Workers always report back to the supervisor
    workflow.add_edge("data_fetcher", "supervisor")
    workflow.add_edge("reviewer", "supervisor")
    
    # The finalizer ends the process
    workflow.add_edge("finalizer", END)
    
    return workflow.compile()
