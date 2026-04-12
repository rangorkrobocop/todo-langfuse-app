import React, { useState } from 'react';
import { useTasks } from './contexts/task-context';
import { ChatMessage } from './types';
import { RevampSidebar } from './components/revamp/sidebar';
import { RevampTaskBoard } from './components/revamp/task-board';
import { RevampAgentConsole } from './components/revamp/agent-console';

/**
 * Internal application state orchestrator.
 * Manages the connection between the UI views and the Agentic backend.
 */
export const Application = () => {
  const { fetchTasks } = useTasks();

  // Agentic UI State
  const [isAgentProcessing, setIsAgentProcessing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [activeTools, setActiveTools] = useState<string[]>([]);

  /**
   * Primary entry point for user-agent interaction.
   * Handles SSE streaming, real-time UI updates, and tool-driven navigation.
   */
  const handleAgentIntent = async (message: string) => {
    setIsAgentProcessing(true);
    setStreamingText('');
    setActiveTools([]);

    // Add user message immediately to the stateful history
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);

    let accumulatedText = '';
    let accumulatedTools: string[] = [];

    try {
      const { API_URL } = await import('./api');
      const { parseAGUIStreamedLine } = await import('./utilities/ag-ui');

      // Connect to the Agentic API endpoint
      const response = await fetch(`${API_URL}/api/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: message })
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      // Process the stream of events (thoughts, tool calls, text)
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            const event = parseAGUIStreamedLine(line);
            if (event) {
              // 1. Handle Tool Calls
              if (event.type === 'TOOL_CALL_START') {
                setActiveTools(prev => [...prev, event.toolName]);
                accumulatedTools.push(event.toolName);

                // Special handling for client-side navigation tool
                if (event.toolName === 'navigateToView' && event.args && event.args.view) {
                  const path = event.args.view === 'completed' ? '?completed=true' : '/';
                  window.history.pushState({}, '', path);
                  window.dispatchEvent(new Event('popstate'));
                  // Ensure task list refreshes to reflect new view
                  setTimeout(() => fetchTasks(), 0);
                }
              }

              // 2. Handle Tool Completion
              if (event.type === 'TOOL_CALL_RESULT') {
                const toolName = event.toolCallId.split('_')[1]; // Extract name from 'call_name'
                setActiveTools(prev => prev.filter(t => t !== toolName));
              }

              // 3. Handle Streaming Content
              if (event.type === 'TEXT_MESSAGE_CONTENT') {
                accumulatedText += event.delta;
                setStreamingText(accumulatedText);
              }
            }
          }
        }
      }

      // Commit the full assistant response to history
      setMessages(prev => {
        const assistMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: accumulatedText || (accumulatedTools.length > 0 ? "System execution complete." : "Request processed."),
          timestamp: new Date().toISOString(),
          tools: accumulatedTools
        };
        return [...prev, assistMsg];
      });
      setStreamingText('');
      await fetchTasks(); // Sync board with latest server state
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Communications Error: ${error.message}`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsAgentProcessing(false);
      setActiveTools([]);
    }
  };

  return (
    <div className="revamp-layout animate-fade-in">
      {/* 1. Primary Navigation */}
      <RevampSidebar />

      {/* 2. Core Workspace */}
      <RevampTaskBoard />

      {/* 3. Operator Intelligence Console */}
      <RevampAgentConsole
        messages={messages}
        streamingText={streamingText}
        activeTools={activeTools}
        onSendMessage={handleAgentIntent}
        isLoading={isAgentProcessing}
      />
    </div>
  );
};