import React, { useState } from 'react';
import { useTasks } from './contexts/task-context';
import { ChatMessage } from './types';
import { RevampSidebar } from './components/revamp/sidebar';
import { RevampTaskBoard } from './components/revamp/task-board';
import { RevampAgentConsole } from './components/revamp/agent-console';
import * as jsonpatch from 'fast-json-patch';

/**
 * Internal application state orchestrator.
 * Manages the connection between the UI views and the Agentic backend.
 */
export const Application = () => {
  const { fetchTasks } = useTasks();

  // Agentic UI State
  const [isAgentProcessing, setIsAgentProcessing] = useState(false);
  const [isAgentVisible, setIsAgentVisible] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [agentState, setAgentState] = useState<any>(null); // For StateSnapshot/Delta

  /**
   * Primary entry point for user-agent interaction.
   * Handles SSE streaming, real-time UI updates, and tool-driven navigation.
   */
  const handleAgentIntent = async (message: string) => {
    setIsAgentProcessing(true);
    setStreamingText('');
    setStreamingReasoning('');
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
    let accumulatedReasoning = '';
    let accumulatedTools: string[] = [];
    let pendingInterrupt: { tool: string; args: any } | undefined = undefined;
    
    // Maintain a local mutable state for the current run's patches
    let currentRunState = agentState;

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
              if (event.type === 'ToolCallStart') {
                setActiveTools(prev => [...prev, event.toolName]);
                accumulatedTools.push(event.toolName);
              }

              if (event.type === 'ToolCallArgs') {
                 try {
                     const parsedArgs = JSON.parse(event.args);
                     const toolName = event.toolCallId.split('_')[1];
                     // Special handling for client-side navigation tool
                     if (toolName === 'navigateToView' && parsedArgs && parsedArgs.view) {
                         const path = parsedArgs.view === 'completed' ? '?completed=true' : '/';
                         window.history.pushState({}, '', path);
                         window.dispatchEvent(new Event('popstate'));
                         setTimeout(() => fetchTasks(), 0);
                     }
                 } catch (e) {
                     // Incomplete JSON fragment
                 }
              }

              // 2. Handle Tool Completion
              if (event.type === 'ToolCallResult') {
                const toolName = event.toolCallId.split('_')[1]; // Extract name from 'call_name'
                setActiveTools(prev => prev.filter(t => t !== toolName));
              }

              // 3. Handle Streaming Content
              if (event.type === 'TextMessageContent') {
                accumulatedText += event.delta;
                setStreamingText(accumulatedText);
              }

              // 4. Handle Reasoning Traces
              if (event.type === 'ReasoningMessageContent') {
                accumulatedReasoning += event.delta;
                setStreamingReasoning(accumulatedReasoning);
              }

              // 5. Handle State Sync (JSON Patch)
              if (event.type === 'StateSnapshot') {
                 currentRunState = event.state;
                 setAgentState(currentRunState);
                 setTimeout(() => fetchTasks(), 0); // Sync react view
              }
              if (event.type === 'StateDelta') {
                 if (currentRunState) {
                     currentRunState = jsonpatch.applyPatch(currentRunState, event.patch).newDocument;
                     setAgentState(currentRunState);
                     setTimeout(() => fetchTasks(), 0); // Sync react view
                 }
              }

              // 6. Handle Run Lifecycle & Interrupts
              if (event.type === 'RunFinished' && event.outcome === 'interrupt') {
                 pendingInterrupt = event.interrupt;
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
          reasoning: accumulatedReasoning,
          timestamp: new Date().toISOString(),
          tools: accumulatedTools,
          interrupt: pendingInterrupt
        };
        return [...prev, assistMsg];
      });
      setStreamingText('');
      setStreamingReasoning('');
      
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

      {/* 3. Operator Intelligence Console (Floating) */}
      <div className={`revamp-agent ${!isAgentVisible ? 'hidden' : ''}`}>
        <RevampAgentConsole
          messages={messages}
          streamingText={streamingText}
          streamingReasoning={streamingReasoning}
          activeTools={activeTools}
          onSendMessage={handleAgentIntent}
          isLoading={isAgentProcessing}
          onClose={() => setIsAgentVisible(false)}
        />
      </div>

      {/* Floating Toggle for Agent */}
      {!isAgentVisible && (
        <button
          onClick={() => setIsAgentVisible(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-transform z-[1001]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
        </button>
      )}
    </div>
  );
};