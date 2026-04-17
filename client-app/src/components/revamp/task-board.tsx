import React from 'react';
import { useTasks } from '@/contexts/task-context';
import { TaskList } from '../task-list';
import { Plus, Filter } from 'lucide-react';
import { useToggle } from '@/utilities/use-toggle';
import { TaskForm } from '../task-form';

/**
 * Main Task Management Workspace.
 * Orchestrates the task list, manual creation form, and filter controls.
 */
export const RevampTaskBoard = () => {
    const { tasks } = useTasks();
    const [showCreate, toggleCreate] = useToggle(false);
    const [showFilters, toggleFilters] = useToggle(false);

    return (
        <div className="revamp-content">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Workspace</h2>
                    <p className="text-slate-500 font-medium">Keep your focus. Get things done.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <button
                            onClick={toggleFilters}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold transition-all hover:bg-slate-50 ${showFilters ? 'bg-slate-100 border-slate-300' : 'bg-white'}`}
                        >
                            <Filter className="w-4 h-4 text-slate-400" />
                            <span>Filter</span>
                        </button>

                        {showFilters && (
                            <div className="absolute top-full right-0 mt-3 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 animate-fade-in">
                                <button className="flex items-center w-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Newest First</button>
                                <button className="flex items-center w-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Oldest First</button>
                                <button className="flex items-center w-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg border-t border-slate-100 mt-1 pt-3">Completed</button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={toggleCreate}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Task</span>
                    </button>
                </div>
            </header>

            {showCreate && (
                <div className="mb-10 p-8 bg-white border border-indigo-100 rounded-3xl shadow-sm animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-500">New Task</span>
                        <button onClick={toggleCreate} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Dismiss</button>
                    </div>
                    <TaskForm onSubmit={() => toggleCreate()} />
                </div>
            )}

            <div className="flex-1 space-y-4">
                <TaskList />
            </div>
        </div>
    );
};
