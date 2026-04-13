# 🧘 ZenDo — Zen Minimalist Task Management

ZenDo is a serene, AI-powered task management workspace built with React, Node.js, and Google Gemini. It features a focused, single-column design and a floating "AI Assistant" that lets you manage your tasks using natural language commands. It also includes local AI observability powered by Langfuse.

---

## ✨ Features

- **Focused Workspace** — A clean, single-column layout designed to minimize distractions and keep you in the flow.
- **AI Assistant** — A glassmorphic floating console powered by Gemini 2.5 Flash for natural language task management.
- **Autonomous Tool Calling** — The agent can create, update, complete, delete, and navigate tasks on your behalf.
- **Real-time Streaming** — Agent responses stream live via Server-Sent Events (SSE).
- **AI Observability** — Built-in local Langfuse tracing to monitor agent actions and token usage.
- **Zen Minimalist UI** — A premium aesthetic with soft shadows, glassmorphism, and smooth animations.

---

## 🚀 Getting Started

The easiest way to run the entire stack (Frontend, Backend, and Langfuse Observability) is using Docker Compose.

### Requirements
- **Docker** and **Docker Compose**
- A **Google Gemini API key** (get one at [aistudio.google.com](https://aistudio.google.com))

### 1. Configuration

Create a `.env` file in the **root** of the project directory:

```bash
# LLM
GEMINI_API_KEY=your_gemini_api_key_here

# Local Langfuse
LANGFUSE_PUBLIC_KEY=pk-lf-b64212b7-6190-4a6b-908f-7cc9fa2e0883
LANGFUSE_SECRET_KEY=sk-lf-de9ec0b5-0dd1-41dd-802a-5fcffa315e44
```

### 2. Start the Stack

Run the following command from the root directory:

```bash
docker compose up -d --build
```

### 3. Access the Services

Once the containers are running, you can access the services at the following URLs:

- **Frontend App**: [http://localhost:4000](http://localhost:4000)
- **Backend API**: [http://localhost:4001](http://localhost:4001)
- **Langfuse Dashboard**: [http://localhost:3000](http://localhost:3000)

*Note: To view your traces in Langfuse, go to the dashboard, sign up locally, and match the API keys from your `.env` file to a new Langfuse project if necessary.*

---

## 🤖 Using the AI Assistant

Click the **Sparkle (✨)** button in the bottom right corner to toggle the **AI Assistant**. Type natural language commands to control your workspace:

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
│       ├── components/revamp/   # Zen Minimalist components
│       ├── application.tsx      # Single-column layout + floating assistant
│       └── utilities/ag-ui.ts   # SSE client for agent streaming
│
├── server/          # Express + SQLite backend
│   └── src/
│       ├── agent.ts     # Gemini tool-calling engine & Langfuse tracing
│       ├── server.ts    # REST API routes + /agent endpoint
│       └── index.ts     # Server entry point
│
└── docker-compose.yml # Orchestrates Client, Server, and Langfuse
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Framer Motion, Tailwind CSS, Lucide Icons |
| Backend | Node.js, Express, SQLite |
| AI | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| Observability | Langfuse (Dockerized locally) |
| Runtime | Node.js (Docker `node:20-slim`) |
