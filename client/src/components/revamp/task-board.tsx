import React from 'react';
import { useTasks } from '@/contexts/task-context';
import { TaskList } from '../task-list';
import { Plus, Filter } from 'lucide-react';
import { useToggle } from '@/utilities/use-toggle';
import { TaskForm } from '../task-form';

export const RevampTaskBoard = () => {
    const { tasks } = useTasks();
    const [showCreate, toggleCreate] = useToggle(false);
    const [showFilters, toggleFilters] = useToggle(false);

    return (
        <div className="revamp-content p-8">
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-black mb-1">Your Space</h2>
                    <p className="text-sm text-[var(--text-dim)]">Manage your tasks effortlessly.</p>
                </div>

                <div className="flex gap-2 relative">
                    <button
                        onClick={toggleFilters}
                        className={`nav-item border border-[var(--border-line)] !px-3 ${showFilters ? 'bg-[var(--panel-hover)]' : ''}`}
                    >
                        <Filter className="w-4 h-4" />
                    </button>

                    {showFilters && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-[var(--panel-bg)] border border-[var(--border-line)] rounded-xl shadow-2xl z-50 p-2 animate-fade-in">
                            <button className="nav-item w-full text-left">Newest First</button>
                            <button className="nav-item w-full text-left">Oldest First</button>
                            <button className="nav-item w-full text-left">Alphabetical</button>
                        </div>
                    )}

                    <button
                        onClick={toggleCreate}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> New Task
                    </button>
                </div>
            </header>

            {showCreate && (
                <div className="mb-8 p-6 bg-[var(--panel-bg)] border border-indigo-500/30 rounded-xl animate-fade-in">
                    <div className="flex justify-between mb-4">
                        <span className="text-xs font-black uppercase tracking-widest text-indigo-400">Quick Draft</span>
                        <button onClick={toggleCreate} className="text-xs text-[var(--text-dim)]">Discard</button>
                    </div>
                    <TaskForm onSubmit={() => toggleCreate()} />
                </div>
            )}

            <div className="flex-1">
                <TaskList />
            </div>
        </div>
    );
};
