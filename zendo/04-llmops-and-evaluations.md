# Strategy: LLMOps & Continuous Evaluation

**Status:** Planned
**Specification:** LLM-as-a-Judge / Observability-driven Development

## Concept
Building an AI app is only half the battle; maintaining its quality as prompts and models change requires rigorous LLMOps. We already have Langfuse installed for tracing, but we need to close the loop with evaluations and user feedback.

## The Strategy

### 1. Human-in-the-Loop Feedback
- Add explicit 👍 / 👎 buttons to the agent's responses in the ZenDo UI.
- Wire these buttons to the Langfuse API to attach "Scores" to specific `runIds`.

### 2. Automated Evaluations (LLM-as-a-Judge)
- Create a background worker that periodically pulls Langfuse traces.
- Use a secondary LLM to evaluate the primary agent's traces against a rubric (e.g., "Did the agent correctly use the `deleteTask` tool when asked? Did it ask for confirmation?").
- Attach these automated scores back into Langfuse.

### 3. Prompt Management
- Move the hardcoded `systemInstruction` out of `agent.ts` and into Langfuse Prompt Management.
- This allows us to A/B test new prompt variations without redeploying the backend.