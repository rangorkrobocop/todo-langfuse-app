# Strategy: Cost & Quota Management

**Status:** Planned
**Pattern:** Token Budget + Per-User Rate Limiting + Cost Attribution

## Concept

Uncontrolled LLM usage is the fastest way to run up unexpected cloud bills. A single agentic loop with many tool calls and large context windows can cost $0.10–$1.00 per run. At 100 users × 50 runs/day, that's $500–$5,000/day. Enterprise deployments need guardrails: per-user token budgets, daily caps, soft-limit warnings, and cost attribution by user/team so finance can chargeback to the right cost center.

---

## The Strategy

### 1. Token Estimation Before and After Each Run

Accurate token counting requires the provider SDK. A practical approximation (±10%) uses character count as a proxy — sufficient for quota enforcement where false negatives (allowing a slightly over-budget run) are acceptable.

```typescript
// agent-service/src/quota.ts

export function estimateTokens(text: string): number {
  // ~4 characters per token is a reasonable approximation across all major models
  return Math.ceil(text.length / 4);
}

export function estimateInputTokens(
  systemInstruction: string,
  tools: Array<{ name: string; description?: string }>,
  intent: string,
  currentState: any[]
): number {
  const toolsStr = JSON.stringify(tools);
  const stateStr = JSON.stringify(currentState);
  return estimateTokens(systemInstruction + toolsStr + stateStr + intent);
}

// For accurate counting (Gemini-specific), use the API:
export async function countTokensGemini(
  model: any,
  contents: string
): Promise<number> {
  const result = await model.countTokens(contents);
  return result.totalTokens;
}
```

Track cumulative token usage per run in the agent loop:

```typescript
// agent-service/src/agent.ts

let inputTokensEstimate = estimateInputTokens(systemInstruction, tools, intent, currentGlobalState);
let outputTokensEstimate = 0;

// After each text chunk:
if (chunk.text) outputTokensEstimate += estimateTokens(chunk.text);

// At run end — emit usage event:
sendEvent({
  type: 'RunFinished',
  runId,
  outcome: 'completed',
  usage: { inputTokens: inputTokensEstimate, outputTokens: outputTokensEstimate }
});

// Write to usage table:
await writeUsage({ runId, userId, inputTokens: inputTokensEstimate, outputTokens: outputTokensEstimate });
```

### 2. Usage Table (Tasks Service Database)

```sql
CREATE TABLE IF NOT EXISTS agent_usage (
  id              SERIAL PRIMARY KEY,
  run_id          TEXT NOT NULL UNIQUE,
  user_id         TEXT NOT NULL DEFAULT 'anonymous',
  tenant_id       TEXT NOT NULL DEFAULT 'default',
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  model           TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  cost_usd_micro  INTEGER NOT NULL DEFAULT 0,  -- cost in micro-dollars (×1,000,000)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_user_idx   ON agent_usage(user_id);
CREATE INDEX IF NOT EXISTS usage_date_idx   ON agent_usage(created_at DESC);

-- Per-user daily quota tracking (materialized via view or scheduled job)
CREATE VIEW user_daily_usage AS
  SELECT
    user_id,
    DATE(created_at) AS day,
    SUM(input_tokens + output_tokens) AS total_tokens,
    SUM(cost_usd_micro) AS total_cost_usd_micro
  FROM agent_usage
  GROUP BY user_id, DATE(created_at);
```

### 3. Per-User Quota Table

```sql
CREATE TABLE IF NOT EXISTS user_quotas (
  user_id           TEXT PRIMARY KEY,
  daily_token_limit INTEGER NOT NULL DEFAULT 100000,    -- 100K tokens/day
  monthly_token_limit INTEGER NOT NULL DEFAULT 2000000, -- 2M tokens/month
  max_concurrent_runs INTEGER NOT NULL DEFAULT 3,
  is_unlimited      BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4. Quota Enforcement in Agent Service

Check quota before starting a run. If the daily limit is exceeded, return a structured error without invoking the LLM:

```typescript
// agent-service/src/quota.ts

const TASKS_SERVICE_URL = process.env.TASKS_SERVICE_URL || 'http://localhost:4002';

export async function checkQuota(userId: string): Promise<{ allowed: boolean; reason?: string; percentUsed?: number }> {
  try {
    const res = await fetch(`${TASKS_SERVICE_URL}/quota/${encodeURIComponent(userId)}`);
    if (!res.ok) return { allowed: true }; // Fail open — don't block runs on quota service errors
    const { dailyUsed, dailyLimit, isUnlimited } = await res.json();
    if (isUnlimited) return { allowed: true };
    const percentUsed = Math.round((dailyUsed / dailyLimit) * 100);
    if (dailyUsed >= dailyLimit) {
      return { allowed: false, reason: `Daily token limit reached (${dailyLimit.toLocaleString()} tokens). Resets at midnight UTC.`, percentUsed: 100 };
    }
    return { allowed: true, percentUsed };
  } catch {
    return { allowed: true }; // Fail open
  }
}
```

In `handleAgentAction`:

```typescript
const quota = await checkQuota(userId);
if (!quota.allowed) {
  sendEvent({ type: 'RunError', runId, error: quota.reason });
  res.write('data: [DONE]\n\n');
  res.end();
  return;
}

// Soft warning at 80%
if ((quota.percentUsed ?? 0) >= 80) {
  sendEvent({
    type: 'TextMessageContent',
    messageId: `msg_quota_warn`,
    delta: `⚠️ You've used ${quota.percentUsed}% of your daily token budget.\n\n`
  });
}
```

### 5. Rate Limiting — Concurrent Runs

Prevent a single user from opening many parallel agent sessions (which could exhaust context windows and run up costs):

```typescript
// agent-service/src/quota.ts

// In-memory for single-node; replace with Redis for multi-node deployments
const activeRuns = new Map<string, number>();

export function acquireRunSlot(userId: string, maxConcurrent = 3): boolean {
  const current = activeRuns.get(userId) ?? 0;
  if (current >= maxConcurrent) return false;
  activeRuns.set(userId, current + 1);
  return true;
}

export function releaseRunSlot(userId: string) {
  const current = activeRuns.get(userId) ?? 1;
  activeRuns.set(userId, Math.max(0, current - 1));
}
```

In `handleAgentAction` — wrap with slot acquisition:

```typescript
if (!acquireRunSlot(userId)) {
  sendEvent({ type: 'RunError', runId, error: 'Too many active sessions. Please wait for a current run to complete.' });
  res.write('data: [DONE]\n\n');
  res.end();
  return;
}
try {
  // ... agent loop ...
} finally {
  releaseRunSlot(userId);
}
```

### 6. Cost Attribution API

```typescript
// tasks-service/src/server.ts

// GET /usage?userId=&from=&to= — admin cost report
app.get('/usage', async (req, res) => {
  const { userId, from, to } = req.query as Record<string, string>;
  const rows = await database.all(
    `SELECT user_id, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens,
            SUM(cost_usd_micro) as cost_usd_micro, COUNT(*) as run_count
     FROM agent_usage
     WHERE (? IS NULL OR user_id = ?)
       AND (? IS NULL OR created_at >= ?)
       AND (? IS NULL OR created_at <= ?)
     GROUP BY user_id ORDER BY cost_usd_micro DESC`,
    [userId ?? null, userId ?? null, from ?? null, from ?? null, to ?? null, to ?? null]
  );
  return res.json(rows.map(r => ({
    ...r,
    cost_usd: r.cost_usd_micro / 1_000_000
  })));
});
```

### 7. Model Cost Table

Different models have different token prices. Keep a cost table for accurate attribution:

```typescript
// agent-service/src/quota.ts

const MODEL_COST_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash':   { input: 0.075,  output: 0.30 },   // USD per 1M tokens
  'claude-sonnet-4-6':  { input: 3.00,   output: 15.00 },
  'claude-haiku-4-5':   { input: 0.80,   output: 4.00 },
  'gpt-4o':             { input: 2.50,   output: 10.00 },
  'gpt-4o-mini':        { input: 0.15,   output: 0.60 },
};

export function estimateCostUsdMicro(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = MODEL_COST_PER_MILLION_TOKENS[model] ?? { input: 1.00, output: 3.00 };
  const usd = (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output;
  return Math.round(usd * 1_000_000); // store as micro-dollars to avoid float precision issues
}
```

---

## Implementation Sequence

1. Add `agent_usage` and `user_quotas` tables to `tasks-service/src/database.ts`
2. Create `agent-service/src/quota.ts` with `estimateTokens`, `checkQuota`, `acquireRunSlot`, `releaseRunSlot`, `estimateCostUsdMicro`
3. Add quota check + slot acquisition at top of `handleAgentAction`
4. Track token usage through the agent loop; write to `agent_usage` table in `finally` block
5. Add `GET /usage` and `GET /quota/:userId` routes in `tasks-service/src/server.ts`
6. Proxy `GET /usage` (admin) and `GET /quota/me` (user-scoped) through BFF
7. Display soft quota warning in client when `percentUsed >= 80`
