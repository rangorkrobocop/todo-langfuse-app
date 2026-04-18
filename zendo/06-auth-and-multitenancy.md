# Strategy: Authentication & Multi-Tenancy

**Status:** Planned
**Pattern:** JWT at Gateway + Row-Level User Scoping

## Concept

ZenDo has no concept of users. Every task is globally shared, every agent call is anonymous, and any caller can read or destroy any data. This is acceptable for a local demo but disqualifies the platform as a reference for enterprise software. Authentication must be enforced at the BFF gateway, and user identity must flow as a verifiable claim through every downstream service — tasks, MCP tools, and the agent loop itself.

---

## The Strategy

### 1. JWT Authentication Layer (BFF Gateway)

The BFF is the single entry point for all client traffic and is the right place to enforce authn. Downstream services trust the `x-user-id` / `x-user-roles` headers forwarded by the BFF — they never re-verify the token.

```typescript
// bff-service/src/middleware/auth.ts
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthenticatedRequest extends Request {
  user: { id: string; email?: string; roles: string[] };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Dev mode: no JWT_SECRET → pass through as anonymous admin
  if (!JWT_SECRET) {
    req.user = { id: 'anonymous', roles: ['user', 'admin'] };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
    req.user = {
      id: payload.sub ?? payload.userId,
      email: payload.email,
      roles: Array.isArray(payload.roles) ? payload.roles : ['user']
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
```

The BFF then attaches the resolved identity to every outbound proxied request:

```typescript
// In bff-service/src/server.ts — CRUD proxy
headers: {
  'Content-Type': 'application/json',
  'x-user-id': req.user.id,
  'x-user-roles': req.user.roles.join(',')
}

// Agent SSE proxy
body: JSON.stringify({ intent, userId: req.user.id, userRoles: req.user.roles })
```

### 2. User-Scoped Task Storage (Tasks Service)

Add `user_id` to the `tasks` table and scope every query to the requesting user. Backward-compat: existing rows default to `'anonymous'`.

```sql
-- Migration (PostgreSQL)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'anonymous';
CREATE INDEX IF NOT EXISTS tasks_user_idx ON tasks(user_id);

-- Migration (SQLite — no IF NOT EXISTS on ALTER TABLE)
BEGIN; ALTER TABLE tasks ADD COLUMN user_id TEXT NOT NULL DEFAULT 'anonymous'; COMMIT;
```

All read/write operations in `tasks-service/src/server.ts` accept `x-user-id` from headers and inject it into SQL:

```typescript
// GET /tasks — scope to caller's userId
const userId = req.headers['x-user-id'] as string ?? 'anonymous';
const tasks = await database.all(
  'SELECT * FROM tasks WHERE completed = 0 AND user_id = ?',
  [userId]
);
```

### 3. RBAC for Destructive MCP Tools

Tag each tool with its minimum required role. The MCP service reads `x-user-roles` from its SSE connection context and enforces before executing:

```typescript
const TOOL_ROLES: Record<string, string[]> = {
  get_tasks:            ['user', 'admin'],
  create_task:          ['user', 'admin'],
  update_task:          ['user', 'admin'],
  delete_task:          ['user', 'admin'],
  clearCompletedTasks:  ['admin'],          // destructive — admin only
  navigateToView:       ['user', 'admin'],
  getDailyBriefing:     ['user', 'admin'],
};

function hasRole(userRoles: string[], required: string[]): boolean {
  return required.some(r => userRoles.includes(r));
}
```

If the caller lacks the required role, the tool returns an error result instead of executing — the agent receives a permission-denied message and relays it to the user.

### 4. Agent Context Propagation

User identity rides alongside the agent's MCP calls so the tools can apply per-user data scoping:

```typescript
// agent-service/src/agent.ts
export const handleAgentAction = async (
  intent: string,
  res: Response,
  userId = 'anonymous',
  userRoles = ['user']
) => { ... }

// All MCP callTool requests include user context
await mcpClient.callTool({
  name: toolCall.name,
  arguments: { ...toolCall.args, _userId: userId, _userRoles: userRoles }
});
```

MCP tools strip the `_userId`/`_userRoles` meta-args before forwarding to the tasks service and instead set the `x-user-id` header on the HTTP call.

---

## Data Model

```
tasks
  id          SERIAL PRIMARY KEY
  title       TEXT
  description TEXT
  completed   INTEGER DEFAULT 0
+ user_id     TEXT NOT NULL DEFAULT 'anonymous'
+ tenant_id   TEXT NOT NULL DEFAULT 'default'    -- for future org-level isolation
```

---

## Implementation Sequence

1. Install `jsonwebtoken` in bff-service: `npm install jsonwebtoken @types/jsonwebtoken`
2. Create `bff-service/src/middleware/auth.ts`
3. Apply middleware to all routes in `bff-service/src/server.ts`; forward user headers
4. Run SQL migration to add `user_id` column in `tasks-service/src/database.ts`
5. Scope all queries in `tasks-service/src/server.ts` by `user_id`
6. Add RBAC check in `mcp-service/src/index.ts` before tool execution
7. Update `agent-service/src/server.ts` to extract userId from request body and pass to `handleAgentAction`

---

## Security Notes

- Never trust `x-user-id` from the client — only the BFF sets it after token verification.
- In production, use short-lived access tokens (15 min) with a refresh token rotation pattern.
- The `clearCompletedTasks` tool's existing `confirmed: true` guard is a UX safeguard; RBAC is the security enforcement layer.
- For true multi-tenancy, add `tenant_id` to all tables and index it. Row-level security in PostgreSQL (`CREATE POLICY`) can enforce isolation at the DB layer for defense in depth.
