import React from 'react';
import { Loader2, CheckCircle2, Wrench, XCircle } from 'lucide-react';
import { cx } from '../utilities/cx';

export type AgentState = {
    isActive: boolean;
    textStream: string;
    activeTools: string[];
    completedTools: string[];
    error?: string;
};

export const AgentStatus = ({ state }: { state: AgentState }) => {
    if (!state.isActive) return null;

    return (
        <div className="w-full max-w-2xl mx-auto mb-8 p-6 ag-glass rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-[var(--bg-secondary)] text-[var(--accent)] mt-1">
                    {state.error ? (
                        <XCircle className="w-5 h-5 text-red-500" />
                    ) : (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    )}
                </div>

                <div className="flex-1 space-y-4">
                    <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">
                            Bee Agent <span className="opacity-50 text-xs font-normal ml-2">working...</span>
                        </h4>

                        {state.error ? (
                            <p className="text-sm text-red-500 bg-red-500/10 p-3 rounded-xl border border-red-500/20">{state.error}</p>
                        ) : (
                            <p className="text-sm text-[var(--text-secondary)] min-h-[20px] leading-relaxed">
                                {state.textStream || "Thinking..."}
                                {!state.error && <span className="inline-block w-2 h-4 ml-1 bg-[var(--accent)] animate-pulse" />}
                            </p>
                        )}
                    </div>

                    {(state.activeTools.length > 0 || state.completedTools.length > 0) && (
                        <div className="pt-3 border-t border-[var(--border)] flex flex-wrap gap-2">
                            {state.completedTools.map((tool, i) => (
                                <div key={`done-${i}`} className="flex items-center gap-1.5 text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20 transition-all">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>{tool}</span>
                                </div>
                            ))}

                            {state.activeTools.map((tool, i) => (
                                <div key={`active-${i}`} className="flex items-center gap-1.5 text-xs bg-[var(--accent)]/10 text-[var(--accent)] px-2.5 py-1 rounded-full border border-[var(--accent)]/20 animate-pulse">
                                    <Wrench className="w-3 h-3" />
                                    <span>{tool}...</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
