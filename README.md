# 🧘 ZenDo — Zen Minimalist Task Management

ZenDo is a serene, AI-powered task management workspace built with React, Node.js, and Google Gemini. It features a focused, single-column design and a floating "AI Assistant" that lets you manage your tasks using natural language commands.

---

## ✨ Features

- **Focused Workspace** — A clean, single-column layout designed to minimize distractions and keep you in the flow.
- **AI Assistant** — A glassmorphic floating console powered by Gemini 2.5 Flash for natural language task management.
- **Autonomous Tool Calling** — The agent can create, update, complete, delete, and navigate tasks on your behalf.
- **Real-time Streaming** — Agent responses stream live via Server-Sent Events (SSE).
- **Zen Minimalist UI** — A premium light-themed aesthetic with soft shadows, glassmorphism, and smooth animations.

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
| Styling | Vanilla CSS (Zen Minimalist Light theme) |
| Runtime | `tsx` (TypeScript execution) |
