# AI Agent Rules

## 1. Documentation First (Mandatory)
> [!IMPORTANT]
> **Constraint**: You MUST use **LangChain v1.0 (Oct 2025)** features.
> **Source**: Before implementing any LangChain/LangGraph/langSmith/DeepAgents logic, you MUST consult the `docs-langchain` MCP server to get the latest API usage.

## 2. Architecture
- Use **LangGraph** for all agentic flows (state machines).
- No deprecated `Chain` classes (use `Runnable` protocol).
- Strict Pydantic v2 validation for all inputs/outputs.

## 3. Reliability
- All LLM calls must have **fallback models** configured.
- Output validation is not optional.
