import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '@/types';
import { Sparkles, Terminal, Send, Cpu, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AgentConsoleProps {
    messages: ChatMessage[];
    streamingText: string;
    activeTools: string[];
    onSendMessage: (msg: string) => void;
    isLoading: boolean;
}

/**
 * Operator Intelligence Console (The Agentic Command Center).
 * Displays a persistent, stateful chat history between the user (Operator) 
 * and the LLM (AI Node). Shows live streaming text and active tool executions.
 */
export const RevampAgentConsole = ({ messages, streamingText, activeTools, onSendMessage, isLoading }: AgentConsoleProps) => {
    const [val, setVal] = React.useState('');
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingText, activeTools]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!val.trim() || isLoading) return;
        onSendMessage(val);
        setVal('');
    };

    return (
        <div className="revamp-agent">
            {/* Header */}
            <div className="p-6 border-b border-[var(--border-line)] flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-black tracking-widest uppercase">Intelligence</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                    <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase">{isLoading ? 'Processing' : 'Standby'}</span>
                </div>
            </div>

            {/* Message History */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 ag-scroll">
                <AnimatePresence initial={false}>
                    {messages.length === 0 && !streamingText && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.2 }}
                            className="h-full flex flex-col items-center justify-center text-center"
                        >
                            <Cpu className="w-12 h-12 mb-4" />
                            <p className="text-sm font-medium">Neural link established.<br />Awaiting instructions.</p>
                        </motion.div>
                    )}

                    {messages.map((m) => (
                        <motion.div
                            key={m.id}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.2 }}
                            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-2">
                                {m.role === 'user' ? 'Operator' : 'AI Node'}
                            </span>
                            <div className={`chat-bubble ${m.role === 'user' ? 'user' : 'ai'}`}>
                                {m.content}
                            </div>
                            {m.tools && m.tools.length > 0 && (
                                <div className="mt-2 flex gap-1">
                                    {m.tools.map((t: string) => (
                                        <span key={t} className="text-[9px] px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded uppercase font-bold">
                                            exec::{t}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {m.confirmationRequested && (
                                <div className="mt-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg flex flex-col gap-2 w-full max-w-[300px]">
                                    <div className="flex items-center gap-2 text-amber-500 text-[10px] font-black uppercase">
                                        <Zap className="w-3 h-3" /> Confirmation Required
                                    </div>
                                    <p className="text-[11px] text-[var(--text-dim)]">
                                        Are you sure you want to {m.confirmationRequested.tool.replace(/([A-Z])/g, ' $1').toLowerCase()}?
                                        {m.confirmationRequested.args.id && ` (Task ID: ${m.confirmationRequested.args.id})`}
                                        {m.confirmationRequested.args.title && ` (Task: "${m.confirmationRequested.args.title}")`}
                                    </p>
                                    <button
                                        onClick={() => {
                                            const confirmMsg = `YES, I confirm the action: ${m.confirmationRequested?.tool} with args ${JSON.stringify(m.confirmationRequested?.args)}. Proceed with confirmed: true.`;
                                            onSendMessage(confirmMsg);
                                        }}
                                        disabled={isLoading}
                                        className="mt-1 w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-black text-[10px] font-black uppercase rounded transition-colors disabled:opacity-50"
                                    >
                                        Confirm Action
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>

                {streamingText && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-start"
                    >
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-2">AI Node (Live)</span>
                        <div className="chat-bubble ai border-l-2 border-indigo-500">
                            {streamingText}
                        </div>
                    </motion.div>
                )}

                {activeTools.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-2 items-center text-[10px] font-bold text-amber-400 animate-pulse mt-4"
                    >
                        <Zap className="w-3 h-3" /> System action in progress: {activeTools.join(', ')}...
                    </motion.div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-6 bg-black/20 border-t border-[var(--border-line)]">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={val}
                        onChange={e => setVal(e.target.value)}
                        disabled={isLoading}
                        placeholder="Issue a command..."
                        className="w-full bg-[var(--panel-hover)] border border-[var(--border-line)] focus:border-indigo-500/50 outline-none rounded-xl py-3 pl-4 pr-12 text-sm transition-all shadow-inner"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !val.trim()}
                        className="absolute right-2 top-1.5 p-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-30 transition-all hover:scale-105 active:scale-95"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
                <p className="text-[9px] text-[var(--text-dim)] mt-3 text-center uppercase tracking-widest opacity-50">
                    Agent-UI Protocol v2.5 // Ready for Input
                </p>
            </div>
        </div>
    );
};
