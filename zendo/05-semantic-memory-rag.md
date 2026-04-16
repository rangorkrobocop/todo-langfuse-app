# Strategy: Semantic Memory & RAG (Retrieval-Augmented Generation)

**Status:** Planned
**Pattern:** Local Vector Embeddings

## Concept
Currently, the agent is injected with the *entire* list of incomplete tasks on every turn. As the user accumulates hundreds of tasks, this wastes tokens and dilutes the model's focus. We need Semantic Memory.

## The Strategy

### 1. Vector Database Integration
- Integrate `pgvector` (a vector search extension for PostgreSQL) directly into the backend.
- Whenever a task is created or updated, generate a text embedding (using Google's embedding models) and store it in a vector column.

### 2. Tool Refactoring
- Remove the global state injection from the system prompt.
- Give the agent a `searchSemanticMemory` tool.
- When the user asks "What was that task about the marketing campaign?", the agent queries the vector DB to retrieve only the top 3 most relevant tasks before formulating a plan.

### 3. Long-term User Context
- Introduce a "User Profile" memory vector. The agent can silently extract preferences (e.g., "User prefers short summaries", "User works on weekends") and store them as semantic memories to personalize future interactions.