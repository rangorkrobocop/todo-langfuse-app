# ZenDo — AI-First Platform

A reference implementation for building AI-native enterprise applications using **Model Context Protocol (MCP)** and **AG-UI** standards. Fully containerized, production-shaped microservices monorepo.

---

## Architecture

```
Client (4000)
    │  REST + SSE
    ▼
BFF (4001) — thin gateway
    │ /tasks/*              │ /api/agent (SSE pipe)
    ▼                       ▼
Tasks Service (4002)    Agent Service (4005)
                            │ MCP/SSE      │ Gemini API
                            ▼              ▼
                        MCP Service (4003)
                            │
                        Tasks Service (4002)

Langfuse (3000) ← traces from Agent, Tasks, MCP services
```

### Services

| Service | Port | Role |
|---|---|---|
| `client-app` | 4000 | React 19 + Vite + Tailwind CSS 4 hybrid UI |
| `bff-service` | 4001 | Thin gateway — proxies CRUD and pipes Agent SSE |
| `tasks-service` | 4002 | CRUD system of record — PostgreSQL 15 + SQLite fallback |
| `mcp-service` | 4003 | MCP tool registry — 7 tools over SSE transport |
| `agent-service` | 4005 | AI orchestrator — Gemini 2.5 Flash + MCP client loop |
| `langfuse` | 3000 | Self-hosted AI observability |

---

## How It Works

### Agent Loop

1. User types intent in the chat console
2. Client POSTs `{ intent }` to BFF `/api/agent`
3. BFF pipes the request to Agent Service and streams the SSE response back
4. Agent Service:
   - Connects to MCP Service as an MCP client
   - Calls `listTools()` — dynamically discovers all 7 tools
   - Sends initial task state snapshot to client (`StateSnapshot`)
   - Runs a Gemini 2.5 Flash chat loop with the discovered tools
   - Streams `<thought>` blocks as reasoning events, text as message events
   - On each tool call: executes via MCP, diffs state with JSON Patch, streams `StateDelta`
   - Loops until Gemini stops requesting tool calls
5. Client patches its local state in real time — no full refetch needed

### AG-UI Protocol

Events streamed over SSE follow the AG-UI standard:

| Event | Meaning |
|---|---|
| `RunStarted` | Agent loop begins |
| `StateSnapshot` | Full task list at run start |
| `ReasoningMessageStart/Content/End` | Gemini `<thought>` blocks |
| `TextMessageStart/Content/End` | Final assistant text |
| `ToolCallStart` | Tool invocation begins |
| `ToolCallResult` | Tool returned a result |
| `StateDelta` | JSON Patch to update client state |
| `RunFinished` | Loop complete |
| `RunError` | Unrecoverable error |

### MCP Tools

The `mcp-service` exposes these tools. The agent discovers them dynamically at runtime — no hardcoding in the agent.

| Tool | Description |
|---|---|
| `get_tasks` | List tasks, optionally filtered by completion status |
| `create_task` | Create a new task |
| `update_task` | Update title, description, or completed status |
| `delete_task` | Delete a task by ID |
| `clearCompletedTasks` | Bulk-delete all completed tasks (requires `confirmed: true`) |
| `navigateToView` | Programmatically navigate the client UI |
| `getDailyBriefing` | Summarize current incomplete tasks |

### Observability

- **Agent Service** — full Langfuse trace per agent run, tagged `gemini`, `agent`, `mcp`
- **Tasks Service** — optional per-request trace (activates when `LANGFUSE_PUBLIC_KEY` is set)
- **MCP Service** — per-tool-call span with input args, output, and error level

---

## Setup

### Prerequisites

- Docker Desktop
- Google Gemini API key — [aistudio.google.com](https://aistudio.google.com)
- Langfuse keys (can self-generate after first run)

### 1. Configure environment

Create `.env` in the repo root:

```bash
GEMINI_API_KEY=your_gemini_key_here

LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

To get Langfuse keys: start the stack once, open http://localhost:3000, create an account and a project, then copy the keys into `.env` and restart.

### 2. Start

```bash
docker compose up -d --build
```

All 8 containers start: `tasks-db`, `tasks-service`, `mcp-service`, `agent-service`, `bff-service`, `client`, `langfuse-service`, `langfuse-db`.

### 3. Open

| URL | What |
|---|---|
| http://localhost:4000 | App UI |
| http://localhost:3000 | Langfuse observability |

---

## Stack

**Backend** — Node.js 20, Express, TypeScript, `tsx`

**AI** — Google Gemini 2.5 Flash (`@google/generative-ai`), MCP SDK (`@modelcontextprotocol/sdk`), Langfuse, `fast-json-patch`

**Frontend** — React 19, Vite 6, Tailwind CSS 4, Framer Motion

**Database** — PostgreSQL 15 (Docker), SQLite (local dev fallback)

**Infrastructure** — Docker Compose, Nginx (client), npm workspaces

---

## Local Development

```bash
# Install all workspace deps from root
npm install

# Run each service independently (requires services to be up or env vars set)
cd tasks-service && npm run dev   # :4002
cd mcp-service   && npm run dev   # :4003
cd agent-service && npm run dev   # :4005
cd bff-service   && npm run dev   # :4001
cd client-app    && npm run dev   # :5173
```

Database: set `DATABASE_URL=postgresql://...` for Postgres or omit for SQLite.

---

## Roadmap

- [ ] Multi-agent supervisor — route intents to specialized Task, CRM, and HR agents
- [ ] RBAC for AI — bind MCP tool availability to user JWT permissions
- [ ] Semantic task search — `pgvector` embeddings on task descriptions
- [ ] MCP Resources — expose large datasets as MCP Resources instead of prompt injection
- [ ] Generative UI — stream React component definitions from the agent for custom widgets
