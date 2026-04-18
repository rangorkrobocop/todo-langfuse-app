import { GoogleGenerativeAI } from '@google/generative-ai';
import { Langfuse } from 'langfuse';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

import type { Response } from 'express';
import * as jsonpatch from 'fast-json-patch/index.mjs';

const MCP_SERVICE_URL = process.env.MCP_SERVICE_URL || 'http://localhost:4003';

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com'
});

/**
 * Handles agent interactions by processing user intent and managing autonomous tool execution.
 * Acts as an MCP Client connecting to the MCP service.
 */
export const handleAgentAction = async (intent: string, res: Response) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    const runId = `run_${Date.now()}`;
    const trace = langfuse.trace({
        id: runId,
        name: "Agent Interaction (MCP)",
        input: intent,
        tags: ["gemini", "agent", "mcp"]
    });

    const sendEvent = (event: any) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    sendEvent({ type: 'RunStarted', runId, timestamp: new Date().toISOString() });

    // 1. Setup MCP Client
    const transport = new SSEClientTransport(new URL(`${MCP_SERVICE_URL}/sse`));
    const mcpClient = new Client({
        name: "zendo-agent-client",
        version: "1.0.0"
    }, {
        capabilities: {}
    });

    try {
        await mcpClient.connect(transport);

        // 2. Discover Tools dynamically from MCP
        const { tools: mcpTools } = await mcpClient.listTools();

        // Convert MCP Tools to Gemini Tools
        const geminiTools = [
            {
                functionDeclarations: mcpTools.map(t => ({
                    name: t.name,
                    description: t.description,
                    parameters: t.inputSchema
                }))
            }
        ];

        // 3. Setup Gemini with discovered tools — fetch initial state via MCP
        const initialStateResult = await mcpClient.callTool({ name: 'get_tasks', arguments: {} });
        let currentGlobalState = JSON.parse((initialStateResult.content[0] as any).text);

        sendEvent({ type: 'StateSnapshot', state: currentGlobalState });

        const systemInstruction = `You are an AG-UI compliant task management assistant. Here are the user's current incomplete tasks: ${JSON.stringify(currentGlobalState)}.

            IMPORTANT:
            1. REASONING FIRST: Use <thought></thought> tags for planning.
            2. TOOL SUMMARIES: Always confirm actions to the user.
            3. You have access to tools discovered via MCP.`;

        const model = ai.getGenerativeModel({
            model: 'gemini-2.5-flash',
            tools: geminiTools,
            systemInstruction
        });

        const chat = model.startChat({});
        let textStarted = false;
        let reasoningStarted = false;
        let inThoughtTag = false;
        let streamBuffer = '';

        // Fix: declare loop-control variables before the while loop
        let isProcessing = true;
        let currentInput: any = intent;
        let finalResponseText = '';

        while (isProcessing) {
            isProcessing = false;
            const toolResponses: any[] = [];

            const interaction = await chat.sendMessageStream(currentInput);

            for await (const chunk of interaction.stream) {
                const functionCalls = chunk.functionCalls();
                if (functionCalls && functionCalls.length > 0) {
                    for (const toolCall of functionCalls) {
                        sendEvent({ type: 'ToolCallStart', toolCallId: `call_${toolCall.name}`, toolName: toolCall.name });

                        // Execute via MCP
                        const result = await mcpClient.callTool({
                            name: toolCall.name,
                            arguments: toolCall.args as any
                        });

                        const textResult = (result.content[0] as any).text;

                        toolResponses.push({
                            functionResponse: {
                                name: toolCall.name,
                                response: { result: textResult }
                            }
                        });

                        sendEvent({ type: 'ToolCallResult', toolCallId: `call_${toolCall.name}`, result: textResult });

                        // Sync state after tool — via MCP
                        const stateResult = await mcpClient.callTool({ name: 'get_tasks', arguments: {} });
                        const newState = JSON.parse((stateResult.content[0] as any).text);
                        const patch = jsonpatch.compare(currentGlobalState, newState);
                        if (patch.length > 0) {
                            sendEvent({ type: 'StateDelta', patch });
                            currentGlobalState = newState;
                        }
                    }
                }

                if (chunk.text && chunk.text()) {
                    streamBuffer += chunk.text();

                    while (streamBuffer.length > 0) {
                        if (!inThoughtTag) {
                            const startIndex = streamBuffer.indexOf('<thought>');
                            if (startIndex !== -1) {
                                // Flush anything before the tag
                                const textPart = streamBuffer.slice(0, startIndex);
                                if (textPart) {
                                    if (!textStarted) { sendEvent({ type: 'TextMessageStart', messageId: `msg_${Date.now()}`, role: 'assistant' }); textStarted = true; }
                                    sendEvent({ type: 'TextMessageContent', messageId: `msg_${Date.now()}`, delta: textPart });
                                    finalResponseText += textPart;
                                }
                                inThoughtTag = true;
                                streamBuffer = streamBuffer.slice(startIndex + 9);
                                if (!reasoningStarted) { sendEvent({ type: 'ReasoningMessageStart', messageId: `reason_${Date.now()}` }); reasoningStarted = true; }
                            } else {
                                // Wait if there's a partial '<' at the end
                                const possibleTagStart = streamBuffer.lastIndexOf('<');
                                if (possibleTagStart !== -1 && streamBuffer.length - possibleTagStart < 9) {
                                    const textPart = streamBuffer.slice(0, possibleTagStart);
                                    if (textPart) {
                                        if (!textStarted) { sendEvent({ type: 'TextMessageStart', messageId: `msg_${Date.now()}`, role: 'assistant' }); textStarted = true; }
                                        sendEvent({ type: 'TextMessageContent', messageId: `msg_${Date.now()}`, delta: textPart });
                                        finalResponseText += textPart;
                                    }
                                    streamBuffer = streamBuffer.slice(possibleTagStart);
                                    break;
                                } else {
                                    if (!textStarted) { sendEvent({ type: 'TextMessageStart', messageId: `msg_${Date.now()}`, role: 'assistant' }); textStarted = true; }
                                    sendEvent({ type: 'TextMessageContent', messageId: `msg_${Date.now()}`, delta: streamBuffer });
                                    finalResponseText += streamBuffer;
                                    streamBuffer = '';
                                }
                            }
                        } else {
                            const endIndex = streamBuffer.indexOf('</thought>');
                            if (endIndex !== -1) {
                                const thoughtPart = streamBuffer.slice(0, endIndex);
                                if (thoughtPart) {
                                    sendEvent({ type: 'ReasoningMessageContent', messageId: `reason_${Date.now()}`, delta: thoughtPart });
                                }
                                inThoughtTag = false;
                                streamBuffer = streamBuffer.slice(endIndex + 10);
                                sendEvent({ type: 'ReasoningMessageEnd', messageId: `reason_${Date.now()}` });
                                reasoningStarted = false;
                            } else {
                                const possibleTagStart = streamBuffer.lastIndexOf('<');
                                if (possibleTagStart !== -1 && streamBuffer.length - possibleTagStart < 10) {
                                    const thoughtPart = streamBuffer.slice(0, possibleTagStart);
                                    if (thoughtPart) {
                                        sendEvent({ type: 'ReasoningMessageContent', messageId: `reason_${Date.now()}`, delta: thoughtPart });
                                    }
                                    streamBuffer = streamBuffer.slice(possibleTagStart);
                                    break;
                                } else {
                                    sendEvent({ type: 'ReasoningMessageContent', messageId: `reason_${Date.now()}`, delta: streamBuffer });
                                    streamBuffer = '';
                                }
                            }
                        }
                    }
                }
            }

            // Flush any remaining buffer at the end of the stream
            if (streamBuffer.length > 0) {
                if (!inThoughtTag) {
                    if (!textStarted) { sendEvent({ type: 'TextMessageStart', messageId: `msg_${Date.now()}`, role: 'assistant' }); textStarted = true; }
                    sendEvent({ type: 'TextMessageContent', messageId: `msg_${Date.now()}`, delta: streamBuffer });
                    finalResponseText += streamBuffer;
                } else {
                    sendEvent({ type: 'ReasoningMessageContent', messageId: `reason_${Date.now()}`, delta: streamBuffer });
                }
                streamBuffer = '';
            }

            if (textStarted && !isProcessing) {
                sendEvent({ type: 'TextMessageEnd', messageId: `msg_${Date.now()}` });
                textStarted = false;
            }

            if (toolResponses.length > 0) {
                isProcessing = true;
                currentInput = toolResponses;
            }
        }

        trace.update({ output: finalResponseText });
        sendEvent({ type: 'RunFinished', runId, outcome: 'completed' });
    } catch (error: any) {
        console.error('Agent error:', error);
        sendEvent({ type: 'RunError', runId, error: error.message });
    } finally {
        res.write('data: [DONE]\n\n');
        res.end();
        await mcpClient.close();
    }
};
