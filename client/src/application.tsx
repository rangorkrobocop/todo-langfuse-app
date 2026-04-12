import React, { useState } from 'react';
import { Header } from './components/header';
import { TaskList } from './components/task-list';
import { TaskForm } from './components/task-form';
import { IntentBar } from './components/intent-bar';
import { useTasks } from './contexts/task-context';

import { AgentStatus, AgentState } from './components/agent-status';

export const Application = () => {
  const { tasks, fetchTasks } = useTasks();
  const [isAgentProcessing, setIsAgentProcessing] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>({
    isActive: false, textStream: '', activeTools: [], completedTools: []
  });

  const handleAgentIntent = async (message: string) => {
    setIsAgentProcessing(true);
    setAgentState({ isActive: true, textStream: '', activeTools: [], completedTools: [] });

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
              setAgentState(prev => {
                const next = { ...prev };
                if (event.type === 'TOOL_CALL_START') {
                  next.activeTools = [...next.activeTools, event.toolName];

                  if (event.toolName === 'navigateToView' && event.args && event.args.view) {
                    if (event.args.view === 'completed') {
                      window.history.pushState({}, '', '?completed=true');
                      window.dispatchEvent(new Event('popstate'));
                    } else if (event.args.view === 'incomplete') {
                      window.history.pushState({}, '', '/');
                      window.dispatchEvent(new Event('popstate'));
                    }
                    setTimeout(() => fetchTasks(), 0);
                  }
                }
                if (event.type === 'TOOL_CALL_RESULT') {
                  // Simply mark the tool as completed
                  const toolName = event.toolCallId.replace('call_', '');
                  next.activeTools = next.activeTools.filter(t => t !== toolName);
                  if (!next.completedTools.includes(toolName)) {
                    next.completedTools = [...next.completedTools, toolName];
                  }
                }
                if (event.type === 'TEXT_MESSAGE_CONTENT') {
                  next.textStream += event.delta;
                }
                if (event.type === 'RUN_ERROR') {
                  next.error = event.error;
                }
                return next;
              });
            }
          }
        }
      }

      await fetchTasks();
    } catch (error: any) {
      console.error("Agentic flow error:", error);
      setAgentState(prev => ({ ...prev, error: error.message }));
    } finally {
      setIsAgentProcessing(false);
      setTimeout(() => setAgentState(prev => ({ ...prev, isActive: false })), 5000);
    }
  };
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] transition-colors relative overflow-hidden">
      {/* Mesh Gradient Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--accent)] opacity-10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--accent)] opacity-10 blur-[120px] rounded-full"></div>

      <div className="relative z-10">
        <Header />

        <main className="max-w-4xl mx-auto px-6 pb-24">
          <div className="mb-8">
            <IntentBar
              onSendMessage={handleAgentIntent}
              isLoading={isAgentProcessing}
            />
          </div>

          <AgentStatus state={agentState} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="md:col-span-2">
              <header className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black tracking-tight flex items-center gap-3">
                  Your Tasks
                  <span className="text-xs bg-[var(--bg-secondary)] px-2 py-1 rounded-full text-[var(--text-secondary)] border border-[var(--border)]">
                    {tasks.length}
                  </span>
                </h2>
              </header>
              <TaskList />
            </div>

            <aside className="space-y-8">
              <section className="ag-glass p-8 rounded-3xl sticky top-32">
                <h3 className="font-black text-xs uppercase tracking-[0.2em] text-[var(--accent)] mb-6">Create Task</h3>
                <TaskForm />
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
};