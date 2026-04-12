export type AGUIEvent =
    | { type: 'RUN_STARTED'; runId: string; timestamp: string }
    | { type: 'TEXT_MESSAGE_START'; messageId: string; role: string }
    | { type: 'TEXT_MESSAGE_CONTENT'; messageId: string; delta: string }
    | { type: 'TOOL_CALL_START'; toolCallId: string; toolName: string; args?: any }
    | { type: 'TOOL_CALL_RESULT'; toolCallId: string; result: string }
    | { type: 'RUN_FINISHED'; runId: string; finishReason: string; usage?: any }
    | { type: 'RUN_ERROR'; runId: string; error: string };

export function parseAGUIStreamedLine(line: string): AGUIEvent | null {
    if (line.startsWith('data: ')) {
        try {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') return null;
            return JSON.parse(dataStr) as AGUIEvent;
        } catch {
            return null;
        }
    }
    return null;
}
