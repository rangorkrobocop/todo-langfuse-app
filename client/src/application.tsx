import React, { useState } from 'react';
import { Header } from './components/header';
import { TaskList } from './components/task-list';
import { TaskForm } from './components/task-form';
import { IntentBar } from './components/intent-bar';
import { useTasks } from './contexts/task-context';

// Changed to a Named Export
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-12">
        <IntentBar
          onSendMessage={handleAgentIntent}
          isLoading={isAgentProcessing}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <header className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                Your Tasks
                <span className="text-sm font-normal text-slate-400">({tasks.length})</span>
              </h2>
            </header>
            <TaskList />
          </div>

          <aside className="space-y-6">
            <section className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold mb-4 text-sm uppercase tracking-wider text-slate-500">Manual Entry</h3>
              <TaskForm />
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
};