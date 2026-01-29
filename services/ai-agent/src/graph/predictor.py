from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import ToolNode, tools_condition
import os

def create_prediction_graph():
    """
    Constructs the NBA Prediction Graph as a dedicated tool-enabled Agent.
    """
    llm = ChatOpenAI(
        model="deepseek-chat",
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        base_url="https://api.deepseek.com"
    )
    
    from tools.nba_tools import tools
    prompt = (
        "你是一个专业的 NBA 分析专家。在给出任何预测之前，你**必须**先调用工具获取球队的最新的战绩、"
        "近期状态和球员数据。特别是进行赛程压力分析时，请务必使用用户提供的比赛日期（Game Date）。"
        "即使你内心知道这两支球队，也请务必核实数据库中的真实数据。"
    )

    # v1.0: Instead of create_agent, we bind tools directly to the LLM
    # and use the nodes/edges to manage the loop.
    llm_with_tools = llm.bind_tools(tools)
    
    def call_model(state: MessagesState):
        messages = [{"role": "system", "content": prompt}] + state["messages"]
        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}
    
    # In LangGraph v1.0, we typically use MessagesState or a custom TypedDict.
    # The agent returned by create_agent is an executable runnable.
    builder = StateGraph(MessagesState)
    builder.add_node("nba_analyst", call_model)
    builder.add_node("tools", ToolNode(tools))
    
    builder.add_edge(START, "nba_analyst")
    builder.add_conditional_edges("nba_analyst", tools_condition)
    builder.add_edge("tools", "nba_analyst")
    
    return builder.compile(checkpointer=MemorySaver())
