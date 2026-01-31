import os

from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent
from tools import tools
from src.models.planner import PlanExecuteState, Plan, Act

# 1. 定义状态 (State)
# Plan-and-Execute 需要追踪输入、计划、已执行步骤和最终响应
# 1. 定义状态 (State) - 移至 src/models/planner.py

# 2. 定义计划的数据结构 (用于 Structured Output)
# 2. 定义计划的数据结构 - 移至 src/models/planner.py

# 3. 定义行动的数据结构 (用于 Replanner 决策)
# 3. 定义行动的数据结构 - 移至 src/models/planner.py

def create_prediction_graph():
    """
    构造 NBA 预测图：采用 Plan-and-Execute 架构。
    """
    llm = ChatOpenAI(
        model="deepseek-chat",
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        base_url="https://api.deepseek.com",
        streaming=True
    )

    # 内部执行器 (Executor)：使用一个预制的 ReAct Agent 来执行具体的单个步骤
    executor = create_react_agent(llm, tools)

    # --- 节点定义 ---

    def plan_step(state: PlanExecuteState):
        """Planner 节点：根据输入创建初始计划。"""
        
        # 0. 动态获取工具描述
        tool_descriptions = "\n".join([f"- {t.name}: {t.description}" for t in tools])

        # 1. 定义 Few-Shot Examples (小样本提示) - 这是固定思路的关键
        few_shot_examples = """
示例 1:
User: "分析一下勇士队最近的表现，也就是最近5场比赛的胜率和库里的场均得分。"
Plan:
{
  "reasoning": "用户想了解勇士队近期状态。这包含两个具体的统计指标：最近5场胜率、库里近5场平均分。我需要先获取勇士队最近的比赛数据，然后计算胜率；同时获取库里这些比赛的数据，就算得分。这也是一个分步过程。",
  "steps": [
    "获取金州勇士队(Golden State Warriors)最近 5 场比赛的详细赛程和比分结果。",
    "基于获取的比赛结果，计算勇士队的胜率。",
    "获取斯蒂芬·库里(Stephen Curry)在上述 5 场比赛中的个人数据。",
    "计算库里这 5 场比赛的平均得分。",
    "整合胜率和球员数据，总结勇士队近期表现。"
  ]
}

示例 2:
User: "比较一下湖人和凯尔特人历史上谁的冠军更多，以及他们最近一次交手的比分。"
Plan:
{
  "reasoning": "这是一个对比任务，包含历史数据（冠军数）和近期事实（最近交手）。这两个信息源可能不同，最好分开查询。",
  "steps": [
    "查询洛杉矶湖人队(Lakers)的历史总冠军数量。",
    "查询波士顿凯尔特人队(Celtics)的历史总冠军数量。",
    "查询湖人和凯尔特人最近一次比赛的日期和最终比分。",
    "对比冠军数量，并结合最近一次交手结果生成回答。"
  ]
}
"""

        planner_prompt = (
            "你是一个顶级的 NBA 分析专家 Agent。\n"
            "你的核心能力是将一个模糊的用户问题，拆解为一系列可执行的、逻辑严密的步骤。\n\n"
            f"你可以用的工具有：\n{tool_descriptions}\n\n"
            "制定计划的原则：\n"
            "1. **详细且具体**：不要说'获取数据'，要说'获取勇士队最近5场的得分数据'。\n"
            "2. **依赖关系**：如果步骤 B 依赖步骤 A 的结果（比如需要先查到 Player ID 才能查数据），请确保顺序正确。\n"
            "3. **必须包含推理(Reasoning)**：在列出 steps 之前，先在 reasoning 字段中用中文分析一下思路。\n\n"
            f"参考以下优秀的思考方式：\n{few_shot_examples}"
        )
        
        planner = llm.with_structured_output(Plan)
        
        # 使用 System Prompt + User Input
        plan_result = planner.invoke([
            {"role": "system", "content": planner_prompt},
            {"role": "user", "content": state["input"]}
        ])
        
        return {"plan": plan_result.steps, "reasoning": plan_result.reasoning}

    def execute_step(state: PlanExecuteState):
        """Executor 节点：执行计划中的第一个步骤。"""
        plan = state["plan"]
        task = plan[0]
        context = (
            f"你当前正在执行计划中的步骤：{task}\n\n"
            f"目标是解决原始任务：{state['input']}\n\n"
            f"请利用工具完成这个特定的步骤，并返回详细的执行结果。"
        )
        
        # 调用 ReAct 代理执行单个原子任务
        result = executor.invoke({"messages": [("user", context)]})
        return {
            "past_steps": [(task, result["messages"][-1].content)]
        }

    def replan_step(state: PlanExecuteState):
        """Replanner 节点：根据执行结果决定是继续还是结束。"""
        replanner_prompt = (
            "你是一个顶级的 NBA 分析专家。根据已有的执行结果，决定后续操作。\n"
            "如果你已经有足够的证据来回答问题，请给出最终答案 (response 设为字符串)。\n"
            "如果你还需要更多步骤，请更新当前的计划列表 (response 设为字符串列表)，删除已完成的，添加必要的后续步骤。"
        )
        replanner = llm.with_structured_output(Act)
        
        # 汇总历史
        history = "\n".join(f"步骤: {k}\n结果: {v}" for k, v in state["past_steps"])
        user_msg = f"原始目标: {state['input']}\n\n执行历史:\n{history}"
        
        result = replanner.invoke([
            {"role": "system", "content": replanner_prompt},
            {"role": "user", "content": user_msg}
        ])
        
        if isinstance(result.response, str):
            return {"response": result.response}
        else:
            return {"plan": result.response}

    # --- 路由逻辑 ---

    def should_continue(state: PlanExecuteState):
        if "response" in state and state["response"]:
            return END
        return "execute"

    # --- 构建图 (StateGraph) ---

    workflow = StateGraph(PlanExecuteState)

    workflow.add_node("planner", plan_step)
    workflow.add_node("execute", execute_step)
    workflow.add_node("replanner", replan_step)

    workflow.set_entry_point("planner")
    workflow.add_edge("planner", "execute")
    workflow.add_edge("execute", "replanner")
    workflow.add_conditional_edges("replanner", should_continue)

    return workflow.compile()
