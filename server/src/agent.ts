import { GoogleGenerativeAI, SchemaType, Tool } from '@google/generative-ai';
import { Langfuse } from 'langfuse';

import type { Response } from 'express';
import * as jsonpatch from 'fast-json-patch/index.mjs';

// Ensure the API key is passed or available via environment variable
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com'
});

/**
 * Handles agent interactions by processing user intent and managing autonomous tool execution.
 */
export const handleAgentAction = async (database: any, intent: string, res: Response) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    console.log(`\n--- New Agent Interaction ---`);
    console.log(`[INCOMING INTENT]: "${intent}"\n`);

    const runId = `run_${Date.now()}`;
    const trace = langfuse.trace({
        id: runId,
        name: "Agent Interaction",
        input: intent,
        tags: ["gemini", "agent", "ag-ui"]
    });

    const sendEvent = (event: any) => {
        const payload = JSON.stringify(event);
        console.log(`[OUTGOING EVENT] ${event.type}`);
        res.write(`data: ${payload}\n\n`);
    };

    sendEvent({ type: 'RunStarted', runId, timestamp: new Date().toISOString() });

    const getIncompleteTasks = await database.prepare('SELECT * FROM tasks WHERE completed = 0');
    const getCompletedTasks = await database.prepare('SELECT * FROM tasks WHERE completed = 1');
    const clearCompletedTasks = await database.prepare('DELETE FROM tasks WHERE completed = 1');
    const createTask = await database.prepare('INSERT INTO tasks (title, description) VALUES (?, ?)');
    const updateTask = await database.prepare('UPDATE tasks SET title = ?, description = ? WHERE id = ?');
    const completeTask = await database.prepare('UPDATE tasks SET completed = 1 WHERE id = ?');
    const deleteTask = await database.prepare('DELETE FROM tasks WHERE title = ?');

    try {
        const tools: Tool[] = [
            {
                functionDeclarations: [
                    {
                        name: 'clearCompletedTasks',
                        description: 'Delete all completed tasks from the database. Use this when the user asks to clear completed tasks. Requires confirmation.',
                        parameters: {
                            type: SchemaType.OBJECT,
                            properties: {
                                confirmed: { type: SchemaType.BOOLEAN, description: 'Must be true to execute the deletion.' }
                            }
                        }
                    },
                    {
                        name: 'createTask',
                        description: 'Create a new task with the given title and description.',
                        parameters: {
                            type: SchemaType.OBJECT,
                            properties: {
                                title: { type: SchemaType.STRING, description: 'The title of the task.' },
                                description: { type: SchemaType.STRING, description: 'The description of the task.' }
                            },
                            required: ["title"]
                        }
                    },
                    {
                        name: 'updateTask',
                        description: 'Update the title or description of a specific task by ID.',
                        parameters: {
                            type: SchemaType.OBJECT,
                            properties: {
                                id: { type: SchemaType.NUMBER, description: 'The ID of the task to update.' },
                                title: { type: SchemaType.STRING, description: 'The new title of the task.' },
                                description: { type: SchemaType.STRING, description: 'The new description of the task.' }
                            },
                            required: ["id", "title"]
                        }
                    },
                    {
                        name: 'completeTask',
                        description: 'Mark a specific task as completed by ID.',
                        parameters: {
                            type: SchemaType.OBJECT,
                            properties: {
                                id: { type: SchemaType.NUMBER, description: 'The ID of the task to complete.' }
                            },
                            required: ["id"]
                        }
                    },
                    {
                        name: 'deleteTask',
                        description: 'Delete a single specific task by title. Requires confirmation.',
                        parameters: {
                            type: SchemaType.OBJECT,
                            properties: {
                                title: { type: SchemaType.STRING, description: 'The title of the task to delete.' },
                                confirmed: { type: SchemaType.BOOLEAN, description: 'Must be true to execute the deletion.' }
                            },
                            required: ["title"]
                        }
                    },
                    {
                        name: 'navigateToView',
                        description: 'Navigate the user interface to view either "completed" tasks or "incomplete" tasks.',
                        parameters: {
                            type: SchemaType.OBJECT,
                            properties: {
                                view: { type: SchemaType.STRING, description: 'The view to navigate to: "completed" or "incomplete"' }
                            },
                            required: ["view"]
                        }
                    },

                    {
                        name: 'getDailyBriefing',
                        description: 'Summarize the currently incomplete tasks.',
                    }
                ]
            }
        ];

        let currentGlobalState = await getIncompleteTasks.all();
        
        // AG-UI: Sync initial state
        sendEvent({ type: 'StateSnapshot', state: currentGlobalState });

        const syncState = async () => {
            const newState = await getIncompleteTasks.all();
            const patch = jsonpatch.compare(currentGlobalState, newState);
            if (patch.length > 0) {
                sendEvent({ type: 'StateDelta', patch });
                currentGlobalState = newState;
            }
        };

        const systemInstruction = `You are an AG-UI compliant task management assistant. Here are the user's current incomplete tasks: ${JSON.stringify(currentGlobalState)}. 
            
            IMPORTANT RULES:
            1. REASONING FIRST: You MUST wrap your internal reasoning or planning in <thought></thought> tags BEFORE giving a final response or calling a tool. Do NOT format these tags inside markdown blocks.
            2. TOOL SUMMARIES: After every tool call, you MUST provide a natural language summary or confirmation to the user in text. Never end with just a tool result.
            3. INTERRUPTS: For DESTRUCTIVE ACTIONS (deleteTask, clearCompletedTasks), you MUST ask the user to confirm the action in text, but execute the tool call immediately with confirmed: false to trigger an interrupt state.

            STRICT RESPONSE PATTERN:
            <thought>
            (Your internal planning, calculations, and tool strategy go here)
            </thought>
            (Your conversational response to the user goes here)
            
            (Optional: Tool calls execute here)`;
            
        const model = ai.getGenerativeModel({
            model: 'gemini-2.5-flash',
            tools: tools,
            systemInstruction
        });

        const chat = model.startChat({});
        let textStarted = false;
        let reasoningStarted = false;
        let inThoughtTag = false;
        let streamBuffer = '';

        const sendWithRetry = async (input: string | any[], maxRetries = 3) => {
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    return await chat.sendMessageStream(input);
                } catch (err: any) {
                    const is429 = err?.status === 429 || err?.message?.includes('429');
                    if (is429 && attempt < maxRetries - 1) {
                        const delayMs = Math.pow(2, attempt + 1) * 10000;
                        await new Promise(r => setTimeout(r, delayMs));
                    } else {
                        throw err;
                    }
                }
            }
            throw new Error('Max retries exceeded');
        };

        let currentInput: string | any[] = intent;
        let isProcessing = true;
        let finalResponseText = '';
        let wasInterrupted = false;
        let interruptDetails = null;

        while (isProcessing && !wasInterrupted) {
            isProcessing = false;
            const toolResponses: any[] = [];
            
            const generation = trace.generation({
                name: "gemini-turn",
                model: "gemini-2.5-flash",
                input: currentInput,
                modelParameters: { systemInstruction }
            });
            
            let turnText = '';
            let turnToolCalls: any[] = [];
            
            const interaction = await sendWithRetry(currentInput);

            for await (const chunk of interaction.stream) {
                const functionCalls = chunk.functionCalls();
                if (functionCalls && functionCalls.length > 0) {
                    turnToolCalls.push(...functionCalls);
                    for (const toolCall of functionCalls) {
                        sendEvent({
                            type: 'ToolCallStart',
                            toolCallId: `call_${toolCall.name}`,
                            toolName: toolCall.name
                        });
                        
                        sendEvent({
                            type: 'ToolCallArgs',
                            toolCallId: `call_${toolCall.name}`,
                            args: JSON.stringify(toolCall.args)
                        });

                        let result = '';
                        let stateChanged = false;

                        if (toolCall.name === 'clearCompletedTasks') {
                            const args = toolCall.args as any;
                            if (args && args.confirmed) {
                                await clearCompletedTasks.run();
                                result = 'All completed tasks have been deleted.';
                                stateChanged = true;
                            } else {
                                wasInterrupted = true;
                                interruptDetails = { tool: 'clearCompletedTasks', args: {} };
                            }
                        } else if (toolCall.name === 'createTask') {
                            const args = toolCall.args as any;
                            if (args && args.title) {
                                await createTask.run([args.title, args.description || '']);
                                result = `Task created successfully with title ${args.title}.`;
                                stateChanged = true;
                            } else {
                                result = `Failed to create task, missing title.`;
                            }
                        } else if (toolCall.name === 'updateTask') {
                            const args = toolCall.args as any;
                            if (args && args.id && args.title) {
                                await updateTask.run([args.title, args.description || '', args.id]);
                                result = `Task ${args.id} updated successfully.`;
                                stateChanged = true;
                            } else {
                                result = `Failed to update task, missing arguments.`;
                            }
                        } else if (toolCall.name === 'completeTask') {
                            const args = toolCall.args as any;
                            if (args && args.id) {
                                await completeTask.run([args.id]);
                                result = `Task ${args.id} marked as completed.`;
                                stateChanged = true;
                            } else {
                                result = `Failed to complete task, missing ID.`;
                            }
                        } else if (toolCall.name === 'deleteTask') {
                            const args = toolCall.args as any;
                            if (args && args.title) {
                                if (args.confirmed) {
                                    await deleteTask.run([args.title]);
                                    result = `Task "${args.title}" deleted successfully.`;
                                    stateChanged = true;
                                } else {
                                    wasInterrupted = true;
                                    interruptDetails = { tool: 'deleteTask', args: { title: args.title } };
                                }
                            } else {
                                result = `Failed to delete task, missing title.`;
                            }
                        } else if (toolCall.name === 'navigateToView') {
                            result = `Successfully instructed the UI to navigate to ${((toolCall.args as any).view) || "unknown"}.`;
                        } else if (toolCall.name === 'getDailyBriefing') {
                            const currentTasks = await getIncompleteTasks.all();
                            result = `System Data: Current incomplete tasks are ${currentTasks.length}. Titles: ${currentTasks.map(t => t.title).join(', ')}. Please summarize this for the user now.`;
                        }

                        if (!wasInterrupted) {
                            toolResponses.push({
                                functionResponse: {
                                    name: toolCall.name,
                                    response: { result }
                                }
                            });

                            sendEvent({
                                type: 'ToolCallResult',
                                toolCallId: `call_${toolCall.name}`,
                                result,
                            });
                            
                            if (stateChanged) {
                                await syncState();
                            }
                        }
                    }
                }

                if (wasInterrupted) break;

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
                                    turnText += textPart;
                                    finalResponseText += textPart;
                                }
                                inThoughtTag = true;
                                streamBuffer = streamBuffer.slice(startIndex + 9);
                                if (!reasoningStarted) { sendEvent({ type: 'ReasoningMessageStart', messageId: `reason_${Date.now()}` }); reasoningStarted = true; }
                            } else {
                                // If there's a partial '<' at the end, it might be the start of a tag, wait for next chunk
                                const possibleTagStart = streamBuffer.lastIndexOf('<');
                                if (possibleTagStart !== -1 && streamBuffer.length - possibleTagStart < 9) {
                                    const textPart = streamBuffer.slice(0, possibleTagStart);
                                    if (textPart) {
                                        if (!textStarted) { sendEvent({ type: 'TextMessageStart', messageId: `msg_${Date.now()}`, role: 'assistant' }); textStarted = true; }
                                        sendEvent({ type: 'TextMessageContent', messageId: `msg_${Date.now()}`, delta: textPart });
                                        turnText += textPart;
                                        finalResponseText += textPart;
                                    }
                                    streamBuffer = streamBuffer.slice(possibleTagStart);
                                    break; // Wait for more chunks
                                } else {
                                    if (!textStarted) { sendEvent({ type: 'TextMessageStart', messageId: `msg_${Date.now()}`, role: 'assistant' }); textStarted = true; }
                                    sendEvent({ type: 'TextMessageContent', messageId: `msg_${Date.now()}`, delta: streamBuffer });
                                    turnText += streamBuffer;
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
                                // If there's a partial '<' at the end, it might be the start of the end tag, wait
                                const possibleTagStart = streamBuffer.lastIndexOf('<');
                                if (possibleTagStart !== -1 && streamBuffer.length - possibleTagStart < 10) {
                                    const thoughtPart = streamBuffer.slice(0, possibleTagStart);
                                    if (thoughtPart) {
                                        sendEvent({ type: 'ReasoningMessageContent', messageId: `reason_${Date.now()}`, delta: thoughtPart });
                                    }
                                    streamBuffer = streamBuffer.slice(possibleTagStart);
                                    break; // Wait for more chunks
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
                    turnText += streamBuffer;
                    finalResponseText += streamBuffer;
                } else {
                     sendEvent({ type: 'ReasoningMessageContent', messageId: `reason_${Date.now()}`, delta: streamBuffer });
                }
                streamBuffer = '';
            }

            if (textStarted && !isProcessing && !wasInterrupted) {
                 sendEvent({ type: 'TextMessageEnd', messageId: `msg_${Date.now()}` });
                 textStarted = false;
            }

            generation.end({
                output: { text: turnText, toolCalls: turnToolCalls }
            });

            if (toolResponses.length > 0 && !wasInterrupted) {
                isProcessing = true;
                currentInput = toolResponses;
            }
        }

        trace.update({ output: finalResponseText });
        
        if (wasInterrupted) {
            sendEvent({ type: 'RunFinished', runId, outcome: 'interrupt', interrupt: interruptDetails });
        } else {
            sendEvent({ type: 'RunFinished', runId, outcome: 'completed' });
        }
    } catch (error: any) {
        console.error('Agent error:', error);
        trace.update({ metadata: { level: 'ERROR', statusMessage: error.message } });
        sendEvent({ type: 'RunError', runId, error: error.message });
    } finally {
        await langfuse.flushAsync();
        res.write('data: [DONE]\n\n');
        res.end();
    }
};
