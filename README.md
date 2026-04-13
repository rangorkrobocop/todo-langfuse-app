# 🐝 BusyBee — Agentic Task Management

BusyBee is a professional, AI-powered task management dashboard built with React, Node.js, and Google Gemini. It features a stateful "Operator Console" that lets you manage your tasks using natural language commands.

---

## ✨ Features

- **Intelligence Console** — Natural language task management powered by Gemini 2.5 Flash
- **Autonomous Tool Calling** — The agent can create, update, complete, delete, and navigate tasks on your behalf
- **Real-time Streaming** — Agent responses stream live via Server-Sent Events (SSE)
- **Stateful Chat History** — The operator console maintains a full conversation history per session
- **Dark Mode UI** — A premium "Deep Space" three-column dashboard design

---

## 🚀 Getting Started

### Requirements
- **Node.js** v22 or higher
- A **Google Gemini API key** (get one at [aistudio.google.com](https://aistudio.google.com))

### Installation

```bash
git clone <repo-url>
cd todo-langfuse-app
npm install
```

### Configure the API Key

1. Navigate to the `server/` directory.
2. Create a file named `.env`.
3. Add your Gemini API key:

```bash
GEMINI_API_KEY=your_api_key_here
```

> **Note:** Your `.env` file is gitignored and will never be committed.

### Run the Application

Open two terminal tabs and run:

```bash
# Terminal 1: Start the Client (React/Vite)
cd client
npm run dev
```

```bash
# Terminal 2: Start the Server (Express/SQLite)
cd server
npm run dev
```

- **Client:** http://localhost:4000
- **Server API:** http://localhost:4001

---

## 🤖 Using the Intelligence Console

The right-hand panel is your **Operator Console**. Type natural language commands to control your tasks:

| Command | What it does |
|---|---|
| `summarize my tasks` | Gives a briefing on your current workload |
| `create a task called Buy groceries` | Creates a new task |
| `complete task 3` | Marks a task as completed |
| `delete task 2` | Permanently deletes a task |
| `go to completed tasks` | Navigates the UI to the completed view |
| `clear completed tasks` | Deletes all completed tasks |

---

## 🏗 Architecture

```
todo-langfuse-app/
├── client/          # React + Vite frontend
│   └── src/
│       ├── components/revamp/   # Three-column dashboard UI
│       ├── application.tsx      # Root app + agent event orchestrator
│       └── utilities/ag-ui.ts  # SSE client for agent streaming
│
└── server/          # Express + SQLite backend
    └── src/
        ├── agent.ts     # Gemini tool-calling engine (SSE streaming)
        ├── server.ts    # REST API routes + /agent endpoint
        └── index.ts     # Server entry point
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Framer Motion, Lucide Icons |
| Backend | Node.js, Express, SQLite |
| AI | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| Styling | Vanilla CSS (Deep Space dark theme) |
| Runtime | `tsx` (TypeScript execution) |
