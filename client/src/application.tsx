import React, { useState } from 'react';
import { useTasks } from './contexts/task-context';
import { ChatMessage } from './types';
import { RevampSidebar } from './components/revamp/sidebar';
import { RevampTaskBoard } from './components/revamp/task-board';
import { RevampAgentConsole } from './components/revamp/agent-console';

export const Application = () => {
  const { fetchTasks } = useTasks();
  const [isAgentProcessing, setIsAgentProcessing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [activeTools, setActiveTools] = useState<string[]>([]);

  const handleAgentIntent = async (message: string) => {
    setIsAgentProcessing(true);
    setStreamingText('');
    setActiveTools([]);

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

      const response = await fetch(`${API_URL}/api/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: message })
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            const event = parseAGUIStreamedLine(line);
            if (event) {
              if (event.type === 'TOOL_CALL_START') {
                setActiveTools(prev => [...prev, event.toolName]);
                accumulatedTools.push(event.toolName);

                if (event.toolName === 'navigateToView' && event.args && event.args.view) {
                  if (event.args.view === 'completed') {
                    window.history.pushState({}, '', '?completed=true');
                  } else {
                    window.history.pushState({}, '', '/');
                  }
                  window.dispatchEvent(new Event('popstate'));
                  setTimeout(() => fetchTasks(), 0);
                }
              }
              if (event.type === 'TOOL_CALL_RESULT') {
                const toolName = event.toolCallId.replace('call_', '');
                setActiveTools(prev => prev.filter(t => t !== toolName));
              }
              if (event.type === 'TEXT_MESSAGE_CONTENT') {
                accumulatedText += event.delta;
                setStreamingText(accumulatedText);
              }
            }
          }
        }
      }

      setMessages(prev => {
        const assistMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: accumulatedText || (accumulatedTools.length > 0 ? "Processed." : "Done."),
          timestamp: new Date().toISOString(),
          tools: accumulatedTools
        };
        return [...prev, assistMsg];
      });
      setStreamingText('');
      await fetchTasks();
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsAgentProcessing(false);
      setActiveTools([]);
    }
  };

  return (
    <div className="revamp-layout animate-fade-in">
      <RevampSidebar />
      <RevampTaskBoard />
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