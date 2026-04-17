import type { Operation } from 'fast-json-patch';

export type AGUIEvent =
    // Run Lifecycle
    | { type: 'RunStarted'; runId: string; timestamp: string }
    | { type: 'RunFinished'; runId: string; outcome: 'completed' | 'error' | 'interrupt'; interrupt?: any }
    | { type: 'RunError'; runId: string; error: string }
    
    // Message Events
    | { type: 'TextMessageStart'; messageId: string; role: string }
    | { type: 'TextMessageContent'; messageId: string; delta: string }
    | { type: 'TextMessageEnd'; messageId: string }

    // Reasoning Traces
    | { type: 'ReasoningMessageStart'; messageId: string }
    | { type: 'ReasoningMessageContent'; messageId: string; delta: string }
    | { type: 'ReasoningMessageEnd'; messageId: string }

    // Tool Events
    | { type: 'ToolCallStart'; toolCallId: string; toolName: string }
    | { type: 'ToolCallArgs'; toolCallId: string; args: string } // Streamed JSON fragments
    | { type: 'ToolCallResult'; toolCallId: string; result: string }

    // State Synchronization (JSON Patch)
    | { type: 'StateSnapshot'; state: any }
    | { type: 'StateDelta'; patch: Operation[] };

export function parseAGUIStreamedLine(line: string): AGUIEvent | null {
    if (line.startsWith('data: ')) {
        try {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') return null;
            return JSON.parse(dataStr) as AGUIEvent;
        } catch {
            return null;
        }
    }
    return null;
}
