# Strategy: Testing Strategy for AI-Native Services

**Status:** Planned
**Pattern:** Layered Test Pyramid — Unit → Integration → Prompt Regression

## Concept

Type checking and linting verify syntax; tests verify behavior. AI services have an additional testing problem: their behavior is probabilistic. The same prompt can produce different tool-call sequences on different runs. A naive test that asserts `expect(output).toBe("exact string")` fails non-deterministically and teaches nothing.

ZenDo currently has unit tests for the tasks service (correct) but zero tests for the agent loop, MCP tools, or prompt behavior (incorrect for a reference implementation). We need a layered strategy that tests each layer with techniques appropriate to that layer's determinism level.

---

## The Strategy

### Layer 1: MCP Tool Unit Tests (Fully Deterministic)

Each MCP tool is a pure function of (args, database state) → result. Test them in isolation with a real in-memory SQLite database — no mocks.

```typescript
// mcp-service/src/__tests__/tools.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase } from '../../tasks-service/src/database.js';

// Shared test harness: spin up an in-memory SQLite DB before each test
let db: any;
beforeEach(async () => {
  db = await getDatabase(':memory:', true);
  await db.run("INSERT INTO tasks (title) VALUES ('Seed task')");
});

describe('create_task tool', () => {
  it('creates a task and returns success message', async () => {
    const res = await fetch('http://localhost:4002/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New task', description: 'Test' })
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toContain('created');
  });
});

describe('clearCompletedTasks tool — RBAC', () => {
  it('requires confirmed: true', async () => {
    // Call tool handler directly with confirmed: false
    // Should return "Requires confirmation." without deleting
  });

  it('requires admin role', async () => {
    // Call with user role 'user' — should return permission denied
  });
});
```

Contract tests ensure the MCP tool schemas match what the agent-service expects:

```typescript
// Check that every tool in ListToolsResponse matches the LLMToolDefinition interface
it('all tools have valid JSON Schema parameters', async () => {
  const { tools } = await mcpClient.listTools();
  for (const tool of tools) {
    expect(tool.inputSchema).toHaveProperty('type', 'object');
    expect(tool.inputSchema).toHaveProperty('properties');
  }
});
```

### Layer 2: Agent Loop Integration Tests (Deterministic via Mock LLM)

The agent loop orchestrates MCP calls, AG-UI events, and JSON Patch diffs. These are deterministic and testable — the only non-deterministic part is the LLM. Replace the LLM with a scripted mock that returns pre-defined responses.

```typescript
// agent-service/src/__tests__/agent.test.ts
import { describe, it, expect, vi } from 'vitest';
import type { LLMProvider, LLMSession, LLMStreamChunk } from '../llm/types.js';

function createMockLLMProvider(responses: LLMStreamChunk[][]): LLMProvider {
  return {
    createSession: () => {
      let callCount = 0;
      return {
        async *stream() {
          const chunks = responses[callCount++] ?? [];
          for (const chunk of chunks) yield chunk;
        }
      } satisfies LLMSession;
    }
  };
}

describe('handleAgentAction', () => {
  it('emits RunStarted → StateSnapshot → ToolCallStart → ToolCallResult → RunFinished for a simple create', async () => {
    // Mock LLM: first turn returns a tool call, second turn returns completion text
    const mockLLM = createMockLLMProvider([
      [{ toolCalls: [{ id: 'call_1', name: 'create_task', args: { title: 'Buy milk' } }] }],
      [{ text: 'Task "Buy milk" has been created.' }]
    ]);

    vi.mock('../llm/index.js', () => ({ createLLMProvider: () => mockLLM }));

    const events: any[] = [];
    const mockRes = { writeHead: vi.fn(), write: (data: string) => {
      if (data.startsWith('data: ')) {
        try { events.push(JSON.parse(data.slice(6))); } catch {}
      }
    }, end: vi.fn() } as any;

    await handleAgentAction('Create a task to buy milk', mockRes);

    const types = events.map(e => e.type);
    expect(types).toContain('RunStarted');
    expect(types).toContain('StateSnapshot');
    expect(types).toContain('ToolCallStart');
    expect(types).toContain('ToolCallResult');
    expect(types).toContain('RunFinished');

    const toolCall = events.find(e => e.type === 'ToolCallStart');
    expect(toolCall.toolName).toBe('create_task');
  });

  it('emits StateDelta when a tool mutates state', async () => {
    // Mock LLM calls create_task, then state changes → StateDelta should appear
    // ...
  });

  it('retries on LLM 429 and eventually succeeds', async () => {
    // Mock LLM throws 429 on first call, succeeds on second
    // Assert RunFinished is emitted (not RunError)
  });
});
```

### Layer 3: Prompt Regression Tests (Probabilistic — Threshold-Based)

These tests run the real LLM against a golden dataset of 20 representative user intents. Each run is scored by an LLM-as-a-Judge evaluator. CI passes if the average score ≥ 0.85.

**Golden Dataset Format:**

```typescript
// agent-service/src/__tests__/prompts/golden-dataset.ts
export const GOLDEN_DATASET = [
  {
    id: 'create-single-task',
    intent: 'Create a task to review the Q3 report',
    expectedToolSequence: ['create_task'],
    rubric: 'Did the agent call create_task exactly once with a meaningful title related to "Q3 report"?'
  },
  {
    id: 'bulk-delete-with-confirmation',
    intent: 'Clear all my completed tasks',
    expectedToolSequence: ['clearCompletedTasks'],
    rubric: 'Did the agent call clearCompletedTasks with confirmed: true? Did it explain what it did?'
  },
  {
    id: 'navigate-completed',
    intent: 'Show me my completed tasks',
    expectedToolSequence: ['navigateToView'],
    rubric: 'Did the agent call navigateToView with view: "completed"? Did it not create any tasks?'
  },
  {
    id: 'daily-briefing',
    intent: 'What do I need to work on today?',
    expectedToolSequence: ['getDailyBriefing'],
    rubric: 'Did the agent call getDailyBriefing and produce a readable summary?'
  },
  // ... 16 more entries
];
```

**LLM-as-a-Judge Evaluator:**

```typescript
// agent-service/src/__tests__/prompts/evaluator.ts
async function scoreRun(
  intent: string,
  actualToolSequence: string[],
  agentResponse: string,
  rubric: string
): Promise<number> {
  const evaluatorPrompt = `
You are evaluating an AI agent's response to the following user intent:
Intent: "${intent}"
Rubric: "${rubric}"

The agent called these tools in order: ${actualToolSequence.join(' → ')}
The agent's final response: "${agentResponse}"

Score from 0.0 to 1.0 where:
- 1.0 = Perfect: tools and response fully satisfy the rubric
- 0.5 = Partial: intent satisfied but with unnecessary steps or minor issues
- 0.0 = Failure: wrong tools called, intent not satisfied, or harmful action taken

Respond with ONLY a number between 0.0 and 1.0.`;

  // Use a cheap, fast model for the judge
  const judgeResponse = await judgeModel.generateContent(evaluatorPrompt);
  return parseFloat(judgeResponse.response.text().trim());
}
```

**CI Integration:**

```typescript
// agent-service/src/__tests__/prompts/regression.test.ts
import { describe, it, expect } from 'vitest';
import { GOLDEN_DATASET } from './golden-dataset.js';

const SCORE_THRESHOLD = 0.85;
const PROMPT_REGRESSION_TIMEOUT = 120_000; // 2 minutes for real LLM calls

describe.skip('Prompt Regression (real LLM — run in dedicated CI job)', () => {
  it.each(GOLDEN_DATASET)('$id scores above threshold', async ({ intent, rubric }) => {
    // Run actual agent, collect tool sequence and response
    const { toolSequence, response } = await runAgent(intent);
    const score = await scoreRun(intent, toolSequence, response, rubric);
    expect(score).toBeGreaterThanOrEqual(SCORE_THRESHOLD);
  }, PROMPT_REGRESSION_TIMEOUT);
});
```

The prompt regression suite is marked `describe.skip` for local runs and enabled via `CI_PROMPT_REGRESSION=true` in a dedicated slow CI job.

### Layer 4: End-to-End Contract Tests

Assert that the BFF correctly proxies requests and that service boundaries honor their contracts:

```typescript
// BFF contract test
it('POST /api/agent requires intent in body', async () => {
  const res = await fetch('http://localhost:4001/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  expect(res.status).toBe(400);
});

it('GET /tasks returns array', async () => {
  const res = await fetch('http://localhost:4001/tasks');
  expect(res.ok).toBe(true);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});
```

---

## Test Configuration

```typescript
// vitest.config.ts (at each service root)
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 10_000,
    hookTimeout: 10_000,
    exclude: ['**/*.prompt.test.ts']  // Exclude slow prompt regression tests
  }
});
```

---

## Implementation Sequence

1. Confirm `vitest` is installed in `agent-service` and `mcp-service` (`package.json`)
2. Create `agent-service/vitest.config.ts`
3. Create `agent-service/src/__tests__/agent.test.ts` with mock LLM + event assertion tests
4. Create `agent-service/src/__tests__/prompts/golden-dataset.ts` (20 test cases)
5. Create `agent-service/src/__tests__/prompts/evaluator.ts` (LLM-as-a-Judge)
6. Create `agent-service/src/__tests__/prompts/regression.test.ts`
7. Create `mcp-service/src/__tests__/tools.test.ts` with contract tests
8. Add `"test": "vitest run"` script to each service's `package.json`
9. Add a `prompt-regression` CI job that runs only on `main` branch merges
