# Strategy: LLM Provider Portability

**Status:** Planned
**Pattern:** Adapter Pattern — Provider-Agnostic Agent Core

## Concept

ZenDo's agent loop is hard-wired to Google Gemini. Enterprise customers routinely have contractual, compliance, or cost constraints that determine which LLM provider they can use. A reference implementation that can only run on one provider is incomplete. More importantly, the agentic *logic* — tool discovery, AG-UI event streaming, JSON Patch state sync — should be entirely independent of which model powers it.

Three things in `agent.ts` are provider-specific:
1. **Model initialization** (`GoogleGenerativeAI`, model config)
2. **Chunk parsing** (`chunk.functionCalls()`, `chunk.text()`)
3. **Tool response format** (`{ functionResponse: { name, response: { result } } }`)

Everything else — the MCP tool loop, AG-UI event sequencing, `<thought>` tag parsing, JSON Patch diffing — is already model-agnostic. We need a thin interface that standardizes those three touch points.

---

## The Strategy

### 1. LLM Interface Contract

```typescript
// agent-service/src/llm/types.ts

export type LLMInput = string | LLMToolResult[];

export interface LLMToolDefinition {
  name: string;
  description?: string;
  parameters: Record<string, any>;  // JSON Schema (MCP inputSchema format)
}

export interface LLMToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface LLMToolResult {
  toolCallId: string;
  toolName: string;
  result: string;
}

export interface LLMStreamChunk {
  toolCalls?: LLMToolCall[];
  text?: string;
}

export interface LLMSession {
  stream(input: LLMInput): AsyncGenerator<LLMStreamChunk>;
}

export interface LLMProvider {
  createSession(opts: {
    systemInstruction: string;
    tools: LLMToolDefinition[];
  }): LLMSession;
}
```

The `LLMSession.stream()` method is the entire surface area. It accepts either a string (user turn) or tool results (model continuation), and yields chunks with either text or tool calls — never both in the same chunk.

### 2. Gemini Adapter (Current Provider, Wrapped)

```typescript
// agent-service/src/llm/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider, LLMSession, LLMInput, LLMStreamChunk, LLMToolDefinition } from './types.js';

export class GeminiProvider implements LLMProvider {
  private ai: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model = 'gemini-2.5-flash') {
    this.ai = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  createSession(opts: { systemInstruction: string; tools: LLMToolDefinition[] }): LLMSession {
    const genModel = this.ai.getGenerativeModel({
      model: this.model,
      tools: [{ functionDeclarations: opts.tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
      systemInstruction: opts.systemInstruction
    });
    const chat = genModel.startChat({});

    return {
      async *stream(input: LLMInput): AsyncGenerator<LLMStreamChunk> {
        const geminiInput = Array.isArray(input)
          ? input.map(r => ({ functionResponse: { name: r.toolName, response: { result: r.result } } }))
          : input;

        const interaction = await chat.sendMessageStream(geminiInput as any);
        for await (const chunk of interaction.stream) {
          const calls = chunk.functionCalls?.();
          if (calls?.length) {
            yield {
              toolCalls: calls.map(fc => ({
                id: `call_${fc.name}_${Date.now()}`,
                name: fc.name,
                args: (fc.args ?? {}) as Record<string, any>
              }))
            };
          }
          const text = chunk.text?.();
          if (text) yield { text };
        }
      }
    };
  }
}
```

### 3. Claude Adapter (Anthropic)

Claude's streaming model is slightly different: text streams incrementally via `content_block_delta` events, while tool calls arrive as complete `tool_use` blocks at stream end. The adapter normalizes this so the agent loop sees the same interface.

```typescript
// agent-service/src/llm/claude.ts
// Requires: npm install @anthropic-ai/sdk (in agent-service)
import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMSession, LLMInput, LLMStreamChunk, LLMToolDefinition } from './types.js';

export class ClaudeProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-6') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  createSession(opts: { systemInstruction: string; tools: LLMToolDefinition[] }): LLMSession {
    const { client, model } = this;
    const messages: Anthropic.MessageParam[] = [];

    return {
      async *stream(input: LLMInput): AsyncGenerator<LLMStreamChunk> {
        if (Array.isArray(input)) {
          messages.push({
            role: 'user',
            content: input.map(r => ({
              type: 'tool_result' as const,
              tool_use_id: r.toolCallId,
              content: r.result
            }))
          });
        } else {
          messages.push({ role: 'user', content: input });
        }

        const stream = client.messages.stream({
          model,
          max_tokens: 8096,
          system: opts.systemInstruction,
          tools: opts.tools.map(t => ({
            name: t.name,
            description: t.description ?? '',
            input_schema: t.parameters as Anthropic.Tool['input_schema']
          })),
          messages
        });

        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            yield { text: event.delta.text };
          }
        }

        const finalMsg = await stream.finalMessage();
        messages.push({ role: 'assistant', content: finalMsg.content });

        const toolUseBlocks = finalMsg.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        );
        if (toolUseBlocks.length > 0) {
          yield {
            toolCalls: toolUseBlocks.map(b => ({
              id: b.id,
              name: b.name,
              args: b.input as Record<string, any>
            }))
          };
        }
      }
    };
  }
}
```

### 4. OpenAI Adapter (Stub)

```typescript
// agent-service/src/llm/openai.ts
// Requires: npm install openai (in agent-service)
import OpenAI from 'openai';
import type { LLMProvider, LLMSession, LLMInput, LLMStreamChunk, LLMToolDefinition } from './types.js';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  createSession(opts: { systemInstruction: string; tools: LLMToolDefinition[] }): LLMSession {
    const { client, model } = this;
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: opts.systemInstruction }
    ];

    return {
      async *stream(input: LLMInput): AsyncGenerator<LLMStreamChunk> {
        if (Array.isArray(input)) {
          for (const r of input) {
            messages.push({ role: 'tool', tool_call_id: r.toolCallId, content: r.result });
          }
        } else {
          messages.push({ role: 'user', content: input });
        }

        const stream = await client.chat.completions.create({
          model,
          messages,
          tools: opts.tools.map(t => ({
            type: 'function' as const,
            function: { name: t.name, description: t.description ?? '', parameters: t.parameters }
          })),
          stream: true
        });

        const toolCallAccumulator: Record<string, { name: string; args: string }> = {};
        let assistantText = '';

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            assistantText += delta.content;
            yield { text: delta.content };
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!toolCallAccumulator[tc.index]) {
                toolCallAccumulator[tc.index] = { name: tc.function?.name ?? '', args: '' };
              }
              toolCallAccumulator[tc.index].args += tc.function?.arguments ?? '';
            }
          }
        }

        messages.push({ role: 'assistant', content: assistantText || null });

        const toolCalls = Object.entries(toolCallAccumulator);
        if (toolCalls.length > 0) {
          yield {
            toolCalls: toolCalls.map(([idx, tc]) => ({
              id: `call_${tc.name}_${idx}`,
              name: tc.name,
              args: JSON.parse(tc.args || '{}')
            }))
          };
        }
      }
    };
  }
}
```

### 5. Environment-Driven Provider Factory

```typescript
// agent-service/src/llm/index.ts
import type { LLMProvider } from './types.js';

export function createLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER ?? 'gemini';

  if (provider === 'gemini') {
    const { GeminiProvider } = await import('./gemini.js') as any;
    return new GeminiProvider(
      process.env.GEMINI_API_KEY ?? '',
      process.env.LLM_MODEL ?? 'gemini-2.5-flash'
    );
  }

  if (provider === 'claude') {
    const { ClaudeProvider } = await import('./claude.js') as any;
    return new ClaudeProvider(
      process.env.ANTHROPIC_API_KEY ?? '',
      process.env.LLM_MODEL ?? 'claude-sonnet-4-6'
    );
  }

  if (provider === 'openai') {
    const { OpenAIProvider } = await import('./openai.js') as any;
    return new OpenAIProvider(
      process.env.OPENAI_API_KEY ?? '',
      process.env.LLM_MODEL ?? 'gpt-4o'
    );
  }

  throw new Error(`Unknown LLM_PROVIDER: ${provider}. Valid values: gemini, claude, openai`);
}

export type { LLMProvider, LLMSession, LLMInput, LLMStreamChunk, LLMToolCall, LLMToolResult, LLMToolDefinition } from './types.js';
```

No code change needed to swap providers — just set env vars:

```bash
# Switch to Claude
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=claude-sonnet-4-6

# Switch to OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o
```

---

## What Changes in agent.ts

The entire Gemini-specific block is replaced by:

```typescript
import { createLLMProvider } from './llm/index.js';
import type { LLMInput, LLMToolResult } from './llm/types.js';

const llm = createLLMProvider();
const session = llm.createSession({ systemInstruction, tools: mcpTools.map(...) });

let currentInput: LLMInput = intent;
while (isProcessing) {
  for await (const chunk of session.stream(currentInput)) {
    if (chunk.toolCalls?.length) { /* execute via MCP */ }
    if (chunk.text) { /* stream through AG-UI thought-tag parser */ }
  }
}
```

The AG-UI streaming logic, JSON Patch diffing, and Langfuse tracing are completely untouched.

---

## Tool Schema Translation

MCP tools use JSON Schema for their `inputSchema`. All three providers accept JSON Schema for function parameters (Gemini calls it `parameters`, Claude calls it `input_schema`, OpenAI calls it `parameters`). The adapter layer handles the rename. No translation of schema structure is needed.

---

## Implementation Sequence

1. Create `agent-service/src/llm/types.ts`
2. Create `agent-service/src/llm/gemini.ts` (wrap existing Gemini code)
3. Create `agent-service/src/llm/claude.ts` (new)
4. Create `agent-service/src/llm/openai.ts` (new)
5. Create `agent-service/src/llm/index.ts` (factory)
6. Refactor `agent-service/src/agent.ts` to use `createLLMProvider()` — remove `GoogleGenerativeAI` import
7. Add `LLM_PROVIDER` and `LLM_MODEL` to `.env` and `docker-compose.yml`
