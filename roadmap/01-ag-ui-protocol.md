# Strategy: Agentic UI (AG-UI) Protocol

**Status:** In Progress (Phase 1 Complete)
**Specification:** [AG-UI Docs](https://docs.ag-ui.com)

## Concept
Moving beyond the "chatbot" request-response paradigm. The LLM acts as a System Operator that dynamically controls the UI state, streams its internal reasoning transparently, and asks for human permission before destructive actions.

## Current Implementation
- SSE streaming backend mapping Gemini tool calls to AG-UI events (`ToolCallStart`, `TextMessageContent`).
- Front-end intercepts reasoning traces (`<thought>`) and renders them distinctly.
- **Interrupt-Aware Lifecycle:** Destructive tools (Delete, Clear) pause execution and emit a `RunFinished` event with an `interrupt` outcome, waiting for human confirmation.

## Next Steps (State of the Art)
1. **Bidirectional JSON Patch (RFC 6902):** Currently, the server sends a full state refresh. We need to implement true `StateDelta` patches where the agent patches the UI state without full reloads.
2. **Declarative Generative UI (A2UI):** Allow the agent to stream JSON structures that tell the client to dynamically render interactive widgets (e.g., a chart of completed tasks) instead of just returning text.
3. **Zero Data Retention (ZDR):** Encrypt the reasoning traces so they are stored purely on the client-side, reducing server liability for PII processed in the agent's chain-of-thought.