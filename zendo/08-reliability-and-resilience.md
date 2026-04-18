# Strategy: Reliability & Resilience

**Status:** Planned
**Pattern:** Retry + Idempotency + SSE Reconnection + Circuit Breaker

## Concept

The current implementation has zero fault tolerance. A single dropped network packet kills the agent run. A Gemini API 429 (rate limit) crashes the loop with an unhandled error. A reconnecting client gets no feedback. Production enterprise systems need resilience at every layer — the LLM call, the MCP tool execution, the SSE connection, and the service-to-service calls.

---

## The Strategy

### 1. LLM Call Retry with Exponential Backoff (Agent Service)

LLM API calls fail transiently for predictable reasons: rate limits (429), capacity exhaustion (503), and transient network errors. These should be retried with exponential backoff + jitter.

```typescript
// agent-service/src/agent.ts

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryable =
        error?.status === 429 ||
        error?.status === 503 ||
        error?.code === 'ECONNRESET' ||
        error?.code === 'ETIMEDOUT';

      if (attempt === maxAttempts || !isRetryable) throw error;

      // Exponential backoff: 1s, 2s, 4s — with ±200ms jitter
      const delay = Math.min(
        1000 * Math.pow(2, attempt - 1) + Math.random() * 200,
        8000
      );
      console.warn(`[agent] ${label} attempt ${attempt} failed (${error?.status ?? error?.code}), retrying in ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }
  throw new Error('Unreachable');
}

// Usage in tool call:
const result = await withRetry(
  () => mcpClient.callTool({ name: toolCall.name, arguments: toolCall.args }),
  `mcp:${toolCall.name}`
);
```

Apply the same wrapper around the LLM session stream initialization for the initial connection:

```typescript
for await (const chunk of await withRetry(
  async () => session.stream(currentInput),
  'llm:stream'
)) { ... }
```

### 2. SSE Event IDs for Reconnection (Agent Service + Client)

Every SSE event emitted by the agent should carry an `id:` line. The browser's `EventSource` API and manual `fetch`-based SSE readers both respect `Last-Event-ID`, enabling resume-from-cursor on reconnect.

```typescript
// agent-service/src/agent.ts
let eventSeq = 0;

const sendEvent = (event: any) => {
  res.write(`id: ${runId}:${eventSeq++}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
};
```

On reconnect, the client passes `Last-Event-ID: run_xxx:42` in the request headers. The agent service can use this to determine how many events the client already received (the sequence number is embedded in the ID), enabling replay or at-minimum a fresh `StateSnapshot` to re-sync.

### 3. Client-Side Reconnection with Backoff (Client App)

The current `handleAgentIntent` in `application.tsx` has no retry logic — a transient network failure shows an error message and requires the user to re-submit. We add a retry loop around the fetch:

```typescript
// client-app/src/application.tsx

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 1000;

const isNetworkError = (e: any) =>
  e instanceof TypeError && (
    e.message.includes('Failed to fetch') ||
    e.message.includes('NetworkError') ||
    e.message.includes('Load failed')
  );

// In handleAgentIntent — wrap the fetch + stream processing:
const connectWithRetry = async (attempt = 1): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/api/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {})
      },
      body: JSON.stringify({ intent: message })
    });
    // ... stream processing loop (unchanged) ...
  } catch (error) {
    if (attempt < MAX_RECONNECT_ATTEMPTS && isNetworkError(error)) {
      const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`[client] SSE connection failed, reconnecting in ${delay}ms (attempt ${attempt})`);
      await new Promise(r => setTimeout(r, delay));
      return connectWithRetry(attempt + 1);
    }
    throw error;
  }
};

// Track last event ID from the stream
let lastEventId = '';
// In the SSE line parser, before parseAGUIStreamedLine:
if (line.startsWith('id: ')) {
  lastEventId = line.slice(4).trim();
  continue;
}
```

### 4. Idempotent MCP Tool Calls

Tool calls that mutate state (create, update, delete) should be idempotent — executing them twice should have the same effect as executing them once. This matters when an agent run is retried after a partial failure.

Each tool call in the agent loop receives an idempotency key derived from `{runId}:{toolCallIndex}`:

```typescript
// agent-service/src/agent.ts
let toolCallIndex = 0;

const result = await mcpClient.callTool({
  name: toolCall.name,
  arguments: {
    ...toolCall.args,
    _idempotencyKey: `${runId}:${toolCallIndex++}`
  }
});
```

The MCP service maintains a short-lived in-memory cache (TTL: 5 minutes) of recent idempotency keys:

```typescript
// mcp-service/src/index.ts
const idempotencyCache = new Map<string, { result: any; expiresAt: number }>();

function checkIdempotency(key: string | undefined): any | null {
  if (!key) return null;
  const cached = idempotencyCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  return null;
}

function cacheResult(key: string | undefined, result: any) {
  if (!key) return;
  idempotencyCache.set(key, { result, expiresAt: Date.now() + 5 * 60 * 1000 });
}
```

The MCP tool handler checks the cache before executing any mutating operation:

```typescript
const { _idempotencyKey, ...cleanArgs } = args as any;
const cached = checkIdempotency(_idempotencyKey);
if (cached) return cached;

// ... execute tool ...
cacheResult(_idempotencyKey, toolResult);
return toolResult;
```

### 5. Circuit Breaker (BFF → Downstream Services)

If the tasks service starts returning 5xx errors repeatedly, the BFF should open a circuit and return 503 immediately rather than queuing requests that will also fail. This prevents cascading failures.

```typescript
// bff-service/src/circuit-breaker.ts
export class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold = 5,
    private readonly windowMs = 60_000,
    private readonly cooldownMs = 30_000
  ) {}

  isOpen(): boolean {
    if (this.state === 'open' && Date.now() - this.lastFailure > this.cooldownMs) {
      this.state = 'half-open';
    }
    return this.state === 'open';
  }

  recordSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure() {
    this.lastFailure = Date.now();
    if (++this.failures >= this.threshold) this.state = 'open';
  }
}
```

---

## Why This Matters (Failure Mode Analysis)

| Failure | Without Resilience | With Resilience |
|---|---|---|
| Gemini API 429 | Agent crashes, `RunError` emitted | Auto-retry after backoff, user unaware |
| WiFi drops mid-stream | User must re-submit intent | Client retries up to 3×, resumes |
| Tool call executed twice | Double create/delete | Idempotency cache returns cached result |
| Tasks service overloaded | BFF queues and amplifies load | Circuit opens, 503 returned immediately |

---

## Implementation Sequence

1. Add `withRetry` helper and `sleep` to `agent-service/src/agent.ts`
2. Wrap MCP `callTool` invocations and LLM stream start with `withRetry`
3. Add `id:` lines to `sendEvent` in `agent-service/src/agent.ts`
4. Add idempotency cache + key stripping in `mcp-service/src/index.ts`
5. Add reconnect loop + `lastEventId` tracking to `client-app/src/application.tsx`
6. Add `CircuitBreaker` class to `bff-service` and wire it into the CRUD proxy
