import { GoogleGenerativeAI, SchemaType, Tool } from '@google/generative-ai';
import { Langfuse } from 'langfuse';
import type { Database } from 'sqlite';
import type { Response } from 'express';

// Ensure the API key is passed or available via environment variable
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com'
});

/**
 * Handles agent interactions by processing user intent and managing autonomous tool execution.
 * This is the core logical engine of the BusyBee Agentic UI.
 * 
 * @param database - Active SQLite database connection
 * @param intent - The user's natural language command
 * @param res - Express response object for streaming (SSE)
 */
export const handleAgentAction = async (database: Database, intent: string, res: Response) => {
    // Set headers for Server-Sent Events (SSE) support.
    // SSE allows us to stream thoughts, tool calls, and text in real-time.
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
        tags: ["gemini", "agent"]
    });

    /** Helper to push events to the client in standard SSE format */
    const sendEvent = (event: any) => {
        const payload = JSON.stringify(event);
        console.log(`[OUTGOING EVENT] ${event.type}: ${payload}`);
        res.write(`data: ${payload}\n\n`);
    };

    sendEvent({ type: 'RUN_STARTED', runId, timestamp: new Date().toISOString() });

    // Pre-prepare reusable SQL statements for efficiency
    const getIncompleteTasks = await database.prepare('SELECT * FROM tasks WHERE completed = 0');
    const getCompletedTasks = await database.prepare('SELECT * FROM tasks WHERE completed = 1');
    const clearCompletedTasks = await database.prepare('DELETE FROM tasks WHERE completed = 1');
    const createTask = await database.prepare('INSERT INTO tasks (title, description) VALUES (?, ?)');
    const updateTask = await database.prepare('UPDATE tasks SET title = ?, description = ? WHERE id = ?');
    const completeTask = await database.prepare('UPDATE tasks SET completed = 1 WHERE id = ?');
    const deleteTask = await database.prepare('DELETE FROM tasks WHERE title = ?');

    try {
        /** Define the capabilities (tools) available to the LLM */
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

        // Fetch current state to provide fresh context for the model's awareness
        const tasks = await getIncompleteTasks.all();
        const systemInstruction = `You are a helpful task management assistant. Here are the user's current incomplete tasks: ${JSON.stringify(tasks)}. 
            
            IMPORTANT:
            1. After every tool call, you MUST provide a natural language summary or confirmation to the user in text.
            2. For DESTRUCTIVE ACTIONS (deleteTask, clearCompletedTasks), if you receive a "Confirmation required" response, you MUST ask the user to confirm the action using the provided UI button. 
            3. Do NOT proceed with destructive actions unless the user explicitly confirms.
            4. Never end with just a tool result.`;
            
        const model = ai.getGenerativeModel({
            model: 'gemini-2.5-flash',
            tools: tools,
            systemInstruction
        });

        const chat = model.startChat({});
        let textStarted = false;

        /**
         * Sends a message to the model with automatic retry on 429 (rate limit) errors.
         * Uses exponential backoff: waits 15s, 30s, 60s before giving up.
         */
        const sendWithRetry = async (input: string | any[], maxRetries = 3) => {
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    return await chat.sendMessageStream(input);
                } catch (err: any) {
                    const is429 = err?.status === 429 || err?.message?.includes('429');
                    if (is429 && attempt < maxRetries - 1) {
                        const delayMs = Math.pow(2, attempt + 1) * 10000; // 20s, 40s
                        console.warn(`[Agent] Rate limited (429). Retrying in ${delayMs / 1000}s... (attempt ${attempt + 1}/${maxRetries})`);
                        await new Promise(r => setTimeout(r, delayMs));
                    } else {
                        throw err;
                    }
                }
            }
            throw new Error('Max retries exceeded');
        };

        // Turn Management Loop
        let currentInput: string | any[] = intent;
        let isProcessing = true;
        let finalResponseText = '';

        while (isProcessing) {
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
                // 1. Handle Tool Execution Requests
                const functionCalls = chunk.functionCalls();
                if (functionCalls && functionCalls.length > 0) {
                    turnToolCalls.push(...functionCalls);
                    for (const toolCall of functionCalls) {
                        sendEvent({
                            type: 'TOOL_CALL_START',
                            toolCallId: `call_${toolCall.name}`,
                            toolName: toolCall.name,
                            args: toolCall.args
                        });

                        let result = '';
                        if (toolCall.name === 'clearCompletedTasks') {
                            const args = toolCall.args as any;
                            if (args && args.confirmed) {
                                await clearCompletedTasks.run();
                                result = 'All completed tasks have been deleted.';
                            } else {
                                sendEvent({ type: 'CONFIRMATION_REQUIRED', tool: 'clearCompletedTasks', args: {} });
                                result = 'ERROR: Confirmation required. Please ask the user to confirm this destructive action.';
                            }
                        } else if (toolCall.name === 'createTask') {
                            const args = toolCall.args as any;
                            if (args && args.title) {
                                await createTask.run([args.title, args.description || '']);
                                result = `Task created successfully with title ${args.title}.`;
                            } else {
                                result = `Failed to create task, missing title.`;
                            }
                        } else if (toolCall.name === 'updateTask') {
                            const args = toolCall.args as any;
                            if (args && args.id && args.title) {
                                await updateTask.run([args.title, args.description || '', args.id]);
                                result = `Task ${args.id} updated successfully.`;
                            } else {
                                result = `Failed to update task, missing arguments.`;
                            }
                        } else if (toolCall.name === 'completeTask') {
                            const args = toolCall.args as any;
                            if (args && args.id) {
                                await completeTask.run([args.id]);
                                result = `Task ${args.id} marked as completed.`;
                            } else {
                                result = `Failed to complete task, missing ID.`;
                            }
                        } else if (toolCall.name === 'deleteTask') {
                            const args = toolCall.args as any;
                            if (args && args.title) {
                                if (args.confirmed) {
                                    await deleteTask.run([args.title]);
                                    result = `Task "${args.title}" deleted successfully.`;
                                } else {
                                    sendEvent({ type: 'CONFIRMATION_REQUIRED', tool: 'deleteTask', args: { title: args.title } });
                                    result = `ERROR: Confirmation required to delete task "${args.title}". Please ask the user to confirm.`;
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

                        toolResponses.push({
                            functionResponse: {
                                name: toolCall.name,
                                response: { result }
                            }
                        });

                        sendEvent({
                            type: 'TOOL_CALL_RESULT',
                            toolCallId: `call_${toolCall.name}`,
                            result,
                        });
                    }
                }

                // 2. Handle Text Content
                if (chunk.text && chunk.text()) {
                    const textContent = chunk.text();
                    turnText += textContent;
                    finalResponseText += textContent;
                    
                    if (!textStarted) {
                        sendEvent({ type: 'TEXT_MESSAGE_START', messageId: `msg_${Date.now()}`, role: 'assistant' });
                        textStarted = true;
                    }
                    sendEvent({ type: 'TEXT_MESSAGE_CONTENT', messageId: `msg_${Date.now()}`, delta: textContent });
                }
            }

            generation.end({
                output: { text: turnText, toolCalls: turnToolCalls }
            });

            // If tools were called, we must provide the answers in the next turn
            if (toolResponses.length > 0) {
                isProcessing = true;
                currentInput = toolResponses;
            }
        }

        trace.update({ output: finalResponseText });
        
        // Signal completion
        sendEvent({ type: 'RUN_FINISHED', runId, finishReason: 'completed' });
    } catch (error: any) {
        console.error('Agent error:', error);
        trace.update({ level: 'ERROR', statusMessage: error.message });
        sendEvent({ type: 'RUN_ERROR', runId, error: error.message });
    } finally {
        await langfuse.flushAsync();
        res.write('data: [DONE]\n\n');
        res.end();
    }
};
