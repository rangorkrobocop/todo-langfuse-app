import React, { useState } from 'react';
import { Header } from './components/header';
import { TaskList } from './components/task-list';
import { TaskForm } from './components/task-form';
import { IntentBar } from './components/intent-bar';
import { useTasks } from './contexts/task-context';

export const Application = () => {
  const { tasks, fetchTasks } = useTasks();
  const [isAgentProcessing, setIsAgentProcessing] = useState(false);

  const handleAgentIntent = async (message: string) => {
    setIsAgentProcessing(true);

    try {
      console.log("Agent processing intent:", message);
      await new Promise(res => setTimeout(res, 1200));

      if (message.toLowerCase().includes('clear')) {
        console.log("Agent Action: Cleanup initiated.");
      }

      await fetchTasks();
    } catch (error) {
      console.error("Agentic flow error:", error);
    } finally {
      setIsAgentProcessing(false);
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
          <div className="mb-12">
            <IntentBar
              onSendMessage={handleAgentIntent}
              isLoading={isAgentProcessing}
            />
          </div>

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