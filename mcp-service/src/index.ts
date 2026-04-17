import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import "dotenv/config";

const TASKS_SERVICE_URL = process.env.TASKS_SERVICE_URL || "http://localhost:4002";
const PORT = process.env.PORT || 4003;

const app = express();
app.use(cors());

/**
 * Initialize the MCP Server
 */
const server = new Server(
  {
    name: "zendo-tasks-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

/**
 * Define Tools List
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_tasks",
        description: "Retrieve a list of tasks. Can filter by completion status.",
        inputSchema: {
          type: "object",
          properties: {
            completed: { type: "boolean", description: "Filter by completed status" },
          },
        },
      },
      {
        name: "create_task",
        description: "Create a new task in the system.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
          },
          required: ["title"],
        },
      },
      {
        name: "update_task",
        description: "Update an existing task.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "number" },
            title: { type: "string" },
            description: { type: "string" },
            completed: { type: "boolean" },
          },
          required: ["id"],
        },
      },
      {
        name: "delete_task",
        description: "Delete a task by ID.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "number" },
          },
          required: ["id"],
        },
      },
      {
        name: "clearCompletedTasks",
        description: "Delete all completed tasks from the database. Use this when the user asks to clear completed tasks. Requires confirmation.",
        inputSchema: {
          type: "object",
          properties: {
            confirmed: { type: "boolean", description: "Must be true to execute the deletion." },
          },
        },
      },
      {
        name: "navigateToView",
        description: "Navigate the user interface to view either 'completed' tasks or 'incomplete' tasks.",
        inputSchema: {
          type: "object",
          properties: {
            view: { type: "string", description: "The view to navigate to: 'completed' or 'incomplete'" },
          },
          required: ["view"],
        },
      },
      {
        name: "getDailyBriefing",
        description: "Summarize the currently incomplete tasks.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

/**
 * Handle Tool Execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_tasks") {
      const url = new URL(`${TASKS_SERVICE_URL}/tasks`);
      if (args?.completed !== undefined) url.searchParams.set("completed", String(args.completed));
      const res = await fetch(url.toString());
      const data = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(data) }] };
    }

    if (name === "create_task") {
      const res = await fetch(`${TASKS_SERVICE_URL}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();
      return { content: [{ type: "text", text: data.message || "Task created" }] };
    }

    if (name === "update_task") {
      const { id, ...updates } = args as any;
      const res = await fetch(`${TASKS_SERVICE_URL}/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      return { content: [{ type: "text", text: data.message || "Task updated" }] };
    }

    if (name === "delete_task") {
      const res = await fetch(`${TASKS_SERVICE_URL}/tasks/${(args as any).id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      return { content: [{ type: "text", text: data.message || "Task deleted" }] };
    }

    if (name === "clearCompletedTasks") {
      if ((args as any)?.confirmed) {
        // Fetch completed tasks
        const url = new URL(`${TASKS_SERVICE_URL}/tasks`);
        url.searchParams.set("completed", "true");
        const res = await fetch(url.toString());
        const completedTasks = await res.json();
        
        // Delete them individually
        for (const task of completedTasks) {
          await fetch(`${TASKS_SERVICE_URL}/tasks/${task.id}`, { method: "DELETE" });
        }
        return { content: [{ type: "text", text: "All completed tasks have been deleted." }] };
      } else {
         return { content: [{ type: "text", text: "Requires confirmation." }] };
      }
    }

    if (name === "navigateToView") {
      return { content: [{ type: "text", text: `Successfully instructed the UI to navigate to ${((args as any).view) || "unknown"}.` }] };
    }

    if (name === "getDailyBriefing") {
      const res = await fetch(`${TASKS_SERVICE_URL}/tasks`);
      const currentTasks = await res.json();
      return { content: [{ type: "text", text: `System Data: Current incomplete tasks are ${currentTasks.length}. Titles: ${currentTasks.map((t: any) => t.title).join(', ')}. Please summarize this for the user now.` }] };
    }

    throw new Error(`Tool not found: ${name}`);
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: error.message }],
    };
  }
});

/**
 * Setup SSE Transport
 */
let transport: SSEServerTransport | null = null;

app.get("/sse", async (req, res) => {
  console.log("New MCP connection established via SSE");
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No active transport");
  }
});

app.listen(PORT, () => {
  console.log(`MCP Tasks Server running on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Message endpoint: http://localhost:${PORT}/messages`);
});
