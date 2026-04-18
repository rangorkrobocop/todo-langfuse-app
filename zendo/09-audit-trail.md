# Strategy: Audit Trail

**Status:** Planned
**Pattern:** Append-Only Event Log + Compliance-Grade Retention

## Concept

Langfuse captures observability data for debugging and model improvement — it's built for engineers. An **audit trail** is a different instrument: an immutable, tamper-evident record that answers compliance questions: *Who triggered this? What tools fired? What data changed? When?*

This distinction matters for enterprise deployments. SOC 2 Type II requires evidence of access control. HIPAA requires audit logs for all data access. Even internal governance frameworks ("who authorized this bulk delete?") need a separate, queryable log that isn't pruned when Langfuse traces expire.

---

## The Strategy

### 1. Audit Log Table (Tasks Service)

The audit log lives in the same PostgreSQL instance as tasks — no new service needed. It is **append-only**: no row is ever updated or deleted during normal operation.

```sql
CREATE TABLE IF NOT EXISTS agent_audit_log (
  id          SERIAL PRIMARY KEY,
  run_id      TEXT NOT NULL,
  user_id     TEXT NOT NULL DEFAULT 'anonymous',
  tenant_id   TEXT NOT NULL DEFAULT 'default',
  intent      TEXT NOT NULL,
  tools_called JSONB NOT NULL DEFAULT '[]',   -- [{name, args_summary, at}]
  outcome     TEXT NOT NULL,                  -- 'completed' | 'interrupted' | 'error'
  error_msg   TEXT,
  started_at  TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS audit_user_idx    ON agent_audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_run_idx     ON agent_audit_log(run_id);
CREATE INDEX IF NOT EXISTS audit_started_idx ON agent_audit_log(started_at DESC);
```

The `tools_called` JSONB column stores a summary of each tool invocation — tool name, sanitized args (no PII), and timestamp. Full args are in Langfuse; the audit log stores intent evidence.

### 2. Write Path (Agent Service)

The agent service writes one audit record per run. The record is opened at `RunStarted` (via a POST to the tasks service audit endpoint) and closed at `RunFinished` / `RunError`:

```typescript
// agent-service/src/agent.ts

interface AuditRecord {
  runId: string;
  userId: string;
  intent: string;
  toolsCalled: Array<{ name: string; argsSummary: string; at: string }>;
  outcome: string;
  errorMsg?: string;
  startedAt: string;
  finishedAt?: string;
}

const audit: AuditRecord = {
  runId,
  userId,
  intent,
  toolsCalled: [],
  outcome: 'error',
  startedAt: new Date().toISOString()
};

// After each tool call:
audit.toolsCalled.push({
  name: toolCall.name,
  argsSummary: sanitizeArgs(toolCall.args),  // strip PII, truncate large values
  at: new Date().toISOString()
});

// In finally block — POST to tasks service:
audit.finishedAt = new Date().toISOString();
await fetch(`${TASKS_SERVICE_URL}/audit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
  body: JSON.stringify(audit)
}).catch(err => console.error('[audit] write failed:', err.message));
// Audit write failure must never crash the agent run — hence .catch()
```

Args sanitization strips values from known sensitive keys and truncates long strings:

```typescript
function sanitizeArgs(args: Record<string, any>): string {
  const SENSITIVE_KEYS = new Set(['password', 'token', 'secret', 'key', 'auth']);
  const sanitized = Object.fromEntries(
    Object.entries(args).map(([k, v]) => [
      k,
      SENSITIVE_KEYS.has(k.toLowerCase())
        ? '[REDACTED]'
        : typeof v === 'string' && v.length > 200 ? v.slice(0, 200) + '…' : v
    ])
  );
  return JSON.stringify(sanitized);
}
```

### 3. Read Path — Audit Endpoint (Tasks Service)

```typescript
// tasks-service/src/server.ts

// POST /audit — write a new audit record (internal, called by agent-service)
app.post('/audit', async (req, res) => {
  const { runId, userId, intent, toolsCalled, outcome, errorMsg, startedAt, finishedAt } = req.body;
  await database.run(
    `INSERT INTO agent_audit_log
       (run_id, user_id, intent, tools_called, outcome, error_msg, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [runId, userId, intent, JSON.stringify(toolsCalled), outcome, errorMsg ?? null, startedAt, finishedAt ?? null]
  );
  return res.status(201).json({ ok: true });
});

// GET /audit — query audit log (admin-only via BFF auth check)
app.get('/audit', async (req, res) => {
  const { userId, from, to, outcome, limit = '50' } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];

  if (userId) { conditions.push('user_id = ?'); params.push(userId); }
  if (from)   { conditions.push('started_at >= ?'); params.push(from); }
  if (to)     { conditions.push('started_at <= ?'); params.push(to); }
  if (outcome) { conditions.push('outcome = ?'); params.push(outcome); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await database.all(
    `SELECT * FROM agent_audit_log ${where} ORDER BY started_at DESC LIMIT ?`,
    [...params, parseInt(limit, 10)]
  );
  return res.json(rows);
});
```

The BFF proxies `GET /audit` with an admin role guard:

```typescript
// bff-service/src/server.ts
app.get('/audit', authMiddleware, requireRole('admin'), async (req, res) => {
  const url = new URL(`${TASKS_SERVICE_URL}/audit`);
  Object.entries(req.query).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const response = await fetch(url.toString(), {
    headers: { 'x-user-id': req.user.id }
  });
  res.status(response.status).send(await response.text());
});
```

### 4. Immutability Guarantees

- The tasks service **never** exposes a `DELETE /audit` or `PUT /audit/:id` endpoint.
- PostgreSQL row-level security (production deployment) should restrict `DELETE` on `agent_audit_log` to a dedicated maintenance role — not the application role.
- For regulated industries: consider writing a hash chain (each row includes `SHA256(prev_row_hash + this_row_data)`) to detect tampering.
- Retention policy: audit logs are kept indefinitely (or per regulatory requirement — typically 7 years). Langfuse traces are pruned at 90 days. These are separate concerns.

### 5. Audit vs. Observability

| Concern | Langfuse Traces | Audit Log |
|---|---|---|
| Audience | Engineers, ML team | Compliance, security, management |
| Granularity | Full token-level detail | Intent + tool names + outcome |
| Mutability | Pruned after retention period | Append-only, never deleted |
| Query interface | Langfuse UI / API | SQL / REST endpoint |
| PII exposure | Contains full prompts | Sanitized args only |
| Retention | 90 days (configurable) | 7 years (compliance-driven) |

---

## Implementation Sequence

1. Add `agent_audit_log` table creation to `tasks-service/src/database.ts`
2. Add `POST /audit` and `GET /audit` routes to `tasks-service/src/server.ts`
3. Add `sanitizeArgs` helper and audit write logic to `agent-service/src/agent.ts`
4. Add `GET /audit` proxy route (admin-only) to `bff-service/src/server.ts`
5. Add `TASKS_SERVICE_URL` to `agent-service` env (for direct audit writes bypassing BFF)
