# AGENTS.md (Agent Working Agreement & Instructions)

This file constitutes the **Global Operating System** for any AI Agent (including Antigravity) working in this repository. Ensure that you adhere to these instructions before emitting code or making architectural decisions.

## 1. Core Principles
1. **Context Asymmetry (Tokens Matter):** Do not send massive context if it isn't necessary. UI state (like `isExpanded`) belongs in React and `data-llm="false"`. Structured tool outputs belong in Python endpoints. Do not mix data payloads with render payloads.
2. **Defensive Progress:** When starting a large task or switching branches, check `.agents/skills` for established patterns. If solving an infrastructure problem, use the provided Skills rather than inventing new shell sequences.
3. **Continuous Checkpoints:** After executing a major phase, update `memory/project/STATE.md` with your progress, known issues, and next steps BEFORE running tests or asking the user for review. This is our Server-Side Compaction strategy to prevent context loss.

## 2. Coding & Implementation Rules
- **TypeScript/Next.js:** Use App Router. Use Server Actions (`src/app/actions/`) by default unless client interactivity is strictly required. For UI components, adhere to Vercel Composition Patterns (`children`, render props) instead of massive boolean props.
- **Python/FastAPI:** Use typed Pydantic models (v2). LangGraph endpoints must clearly separate `Data Tools` (return pure JSON) from `Render Tools` (return UI logic).
- **Tailwind CSS:** No inline complex arbitrary values if they can be extracted to `tailwind.config.js`. Use CSS variables for global themes (e.g., `--brand-blue`).

## 3. The "Harness" Environment
- **Running Tests:** Always run `npm test` or `pytest` explicitly if making changes to core files.
- **Eval-Driven Checks:** For large Agent refactors, look into `evals/graders/`. Never write a massive LLM feature without verifying small, deterministic inputs first.

## 4. Multi-Agent Hand-off Protocol
Whenever you decide a task is outside your immediate contextual reasoning or too large, divide the task into sub-tasks in `memory/project/STATE.md` and instruct the user that "I have compacted the context and recorded progress in STATE.md. Please approve to continue to Phase X." This enforces manual-compaction gracefully.
