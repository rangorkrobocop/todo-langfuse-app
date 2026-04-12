import { GoogleGenerativeAI, SchemaType, Tool } from '@google/generative-ai';
import type { Database } from 'sqlite';
import type { Response } from 'express';

// Ensure the API key is passed or available via environment variable
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const handleAgentAction = async (database: Database, intent: string, res: Response) => {
    // Set headers for SSE support
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    console.log(`\n--- New Agent Interaction ---`);
    console.log(`[INCOMING INTENT]: "${intent}"\n`);

    const sendEvent = (event: any) => {
        const payload = JSON.stringify(event);
        console.log(`[OUTGOING EVENT] ${event.type}: ${payload}`);
        res.write(`data: ${payload}\n\n`);
    };

    const runId = `run_${Date.now()}`;
    sendEvent({ type: 'RUN_STARTED', runId, timestamp: new Date().toISOString() });

    const getIncompleteTasks = await database.prepare('SELECT * FROM tasks WHERE completed = 0');
    const getCompletedTasks = await database.prepare('SELECT * FROM tasks WHERE completed = 1');
    const clearCompletedTasks = await database.prepare('DELETE FROM tasks WHERE completed = 1');
    const createTask = await database.prepare('INSERT INTO tasks (title, description) VALUES (?, ?)');
    const updateTask = await database.prepare('UPDATE tasks SET title = ?, description = ? WHERE id = ?');
    const completeTask = await database.prepare('UPDATE tasks SET completed = 1 WHERE id = ?');
    const deleteTask = await database.prepare('DELETE FROM tasks WHERE id = ?');

    try {
        const tools: Tool[] = [
            {
                functionDeclarations: [
                    {
                        name: 'clearCompletedTasks',
                        description: 'Delete all completed tasks from the database. Use this when the user asks to clear completed tasks.',
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
                        description: 'Delete a single specific task by ID.',
                        parameters: {
                            type: SchemaType.OBJECT,
                            properties: {
                                id: { type: SchemaType.NUMBER, description: 'The ID of the task to delete.' }
                            },
                            required: ["id"]
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

        // We can fetch current state to give context
        const incomplete = await getIncompleteTasks.all();

        const model = ai.getGenerativeModel({
            model: 'gemini-2.5-flash',
            tools: tools,
            systemInstruction: `You are a helpful task management assistant. Here are the user's current incomplete tasks: ${JSON.stringify(incomplete)}. Call clearCompletedTasks if they ask to clear tasks. Answer concisely.`,
        });

        const chat = model.startChat({});


        // Send initial request with tools
        let textStarted = false;

        // Use SSE to stream the conversation back
        const responseStream = await chat.sendMessageStream(intent);

        for await (const chunk of responseStream.stream) {
            // If the model decides to call a tool
            const functionCalls = chunk.functionCalls();
            if (functionCalls && functionCalls.length > 0) {
                for (const toolCall of functionCalls) {
                    sendEvent({
                        type: 'TOOL_CALL_START',
                        // function calls don't always have an ID in all Gemini versions, so we use the name as ID or a random one
                        toolCallId: `call_${toolCall.name}`,
                        toolName: toolCall.name,
                        args: toolCall.args
                    });

                    let result = '';
                    if (toolCall.name === 'clearCompletedTasks') {
                        await clearCompletedTasks.run();
                        result = 'All completed tasks have been deleted.';
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
                        if (args && args.id) {
                            await deleteTask.run([args.id]);
                            result = `Task ${args.id} deleted successfully.`;
                        } else {
                            result = `Failed to delete task, missing ID.`;
                        }
                    } else if (toolCall.name === 'navigateToView') {
                        result = `Successfully instructed the UI to navigate to ${((toolCall.args as any).view) || "unknown"}.`;
                    } else if (toolCall.name === 'getDailyBriefing') {
                        result = `You have ${incomplete.length} incomplete tasks. Please summarize them briefly.`;
                    } else {
                        result = `Tool ${toolCall.name} not implemented.`;
                    }

                    sendEvent({
                        type: 'TOOL_CALL_RESULT',
                        toolCallId: `call_${toolCall.name}`,
                        result,
                    });
                }
            }

            // If the model is outputting text content
            if (chunk.text && chunk.text()) {
                if (!textStarted) {
                    sendEvent({ type: 'TEXT_MESSAGE_START', messageId: `msg_${Date.now()}`, role: 'assistant' });
                    textStarted = true;
                }
                sendEvent({ type: 'TEXT_MESSAGE_CONTENT', messageId: `msg_${Date.now()}`, delta: chunk.text() });
            }
        }

        sendEvent({ type: 'RUN_FINISHED', runId, finishReason: 'completed' });
    } catch (error: any) {
        console.error('Agent error:', error);
        sendEvent({ type: 'RUN_ERROR', runId, error: error.message });
    } finally {
        res.write('data: [DONE]\n\n');
        res.end();
    }
};
