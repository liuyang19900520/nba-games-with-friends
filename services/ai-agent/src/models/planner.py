import operator
from typing import Annotated, List, Optional, Tuple, TypedDict, Union

from pydantic import BaseModel, Field


# 1. 定义状态 (State) - 这个 State 其实是 Aggregate Root，用于在 Graph 中传递
class PlanExecuteState(TypedDict):
    input: str
    plan: List[str]
    past_steps: Annotated[List[Tuple[str, str]], operator.add]
    response: str
    reasoning: str  # 存储 Plan 阶段的思考过程，便于调试和回顾
    prediction_result: Optional[dict]  # Structured PredictionResult as dict


# 2. 定义计划的数据结构 (LLM DTO)
class Plan(BaseModel):
    """一个包含分析思路和具体执行步骤的计划。"""

    reasoning: str = Field(
        description="在制定计划前的思考过程。分析用户意图，确定需要哪些数据。"
    )
    steps: List[str] = Field(
        description="具体的执行步骤列表，每一步都应该是清晰、独立的行动。"
    )


# 3. 定义行动的数据结构 (用于 Replanner 决策)
class Act(BaseModel):
    """
    计划的下一步动作。你可以选择更新计划 (List[str])，或者给出一个最终答案 (str)。
    """

    response: Union[str, List[str]] = Field(
        description="如果任务完成，返回最终答案字符串；如果任务未完成，返回新的步骤列表。"
    )
