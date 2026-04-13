import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '@/types';
import { Sparkles, Terminal, Send, Cpu, Zap, X, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AgentConsoleProps {
    messages: ChatMessage[];
    streamingText: string;
    activeTools: string[];
    onSendMessage: (msg: string) => void;
    isLoading: boolean;
    onClose?: () => void;
}

/**
 * Operator Intelligence Console (The Agentic Command Center).
 * Displays a persistent, stateful chat history between the user (Operator) 
 * and the LLM (AI Node). Shows live streaming text and active tool executions.
 */
export const RevampAgentConsole = ({ messages, streamingText, activeTools, onSendMessage, isLoading, onClose }: AgentConsoleProps) => {
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
        <div className="flex flex-col h-full bg-white/40 backdrop-blur-xl">
            {/* Header */}
            <div className="p-5 border-b border-[var(--border-line)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                        <Bot className="w-4 h-4" />
                    </div>
                    <div>
                        <span className="text-sm font-bold block leading-none">AI Assistant</span>
                        <span className="text-[10px] text-[var(--text-dim)] uppercase font-bold tracking-wider">
                            {isLoading ? 'Thinking...' : 'Online'}
                        </span>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors text-[var(--text-dim)]">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Message History */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 ag-scroll">
                <AnimatePresence initial={false}>
                    {messages.length === 0 && !streamingText && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="h-full flex flex-col items-center justify-center text-center px-6"
                        >
                            <Sparkles className="w-10 h-10 mb-4 text-indigo-600/30" />
                            <p className="text-sm text-[var(--text-dim)] font-medium">Hello! I'm your AI assistant. How can I help you manage your tasks today?</p>
                        </motion.div>
                    )}

                    {messages.map((m) => (
                        <motion.div
                            key={m.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                        >
                            <div className={`chat-bubble ${m.role === 'user' ? 'user' : 'ai'}`}>
                                {m.content}
                            </div>
                            {m.tools && m.tools.length > 0 && (
                                <div className="mt-2 flex gap-1">
                                    {m.tools.map((t: string) => (
                                        <span key={t} className="text-[9px] px-2 py-0.5 bg-indigo-600/5 text-indigo-600 rounded-full font-bold">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {m.confirmationRequested && (
                                <div className="mt-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex flex-col gap-3 w-full max-w-[320px]">
                                    <div className="flex items-center gap-2 text-amber-700 text-[11px] font-bold uppercase tracking-wider">
                                        <Zap className="w-3 h-3" /> Confirmation
                                    </div>
                                    <p className="text-[13px] text-amber-900/80 leading-relaxed">
                                        I'll {m.confirmationRequested.tool.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                        {m.confirmationRequested.args.title ? ` "${m.confirmationRequested.args.title}"` : ' this task'}. 
                                        Shall I proceed?
                                    </p>
                                    <button
                                        onClick={() => {
                                            const confirmMsg = `YES, I confirm the action: ${m.confirmationRequested?.tool} with args ${JSON.stringify(m.confirmationRequested?.args)}. Proceed with confirmed: true.`;
                                            onSendMessage(confirmMsg);
                                        }}
                                        disabled={isLoading}
                                        className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        Confirm
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>

                {streamingText && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-start"
                    >
                        <div className="chat-bubble ai bg-indigo-50/50">
                            {streamingText}
                        </div>
                    </motion.div>
                )}

                {activeTools.length > 0 && (
                    <div className="flex gap-2 items-center text-[10px] font-bold text-indigo-600 bg-indigo-50/50 px-3 py-1 rounded-full w-fit animate-pulse">
                        Working on it...
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-5 bg-white border-t border-[var(--border-line)]">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={val}
                        onChange={e => setVal(e.target.value)}
                        disabled={isLoading}
                        placeholder="Type a message..."
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500/30 focus:bg-white outline-none rounded-2xl py-3.5 pl-5 pr-12 text-sm transition-all"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !val.trim()}
                        className="absolute right-2 top-2 p-2 rounded-xl bg-indigo-600 text-white disabled:opacity-30 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-200"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    );
};
