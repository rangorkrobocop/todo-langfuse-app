# Strategy: Multi-Agent Orchestration (Router/Swarm Pattern)

**Status:** Planned
**Pattern:** LangGraph / CrewAI Swarm concepts

## Concept
Currently, ZenDo uses a single, monolithic Gemini prompt injected with all tools and all state. This does not scale. The state-of-the-art approach is Multi-Agent Orchestration, where specialized agents handle specific domains, routed by a Supervisor.

## The Strategy
1. **The Supervisor (Router):** A fast, low-latency model (e.g., Gemini 2.5 Flash) whose only job is intent classification. 
2. **The Sub-Agents:**
    * **Task Operator Agent:** Has access to the database tools (Create, Update, Delete).
    * **Data Analyst Agent:** Has access to `pgvector` or raw SQL to analyze trends (e.g., "Am I getting faster at completing tasks?").
    * **UI Controller Agent:** Only has tools for navigating the UI and generating dynamic A2UI widgets.

## Technical Implementation
- Implement a state graph (similar to LangGraph) in pure TypeScript.
- Pass a shared `State` object between agents.
- Emit AG-UI events representing "Agent Handoffs" so the user can see in the UI when the "Supervisor" transfers the task to the "Data Analyst."