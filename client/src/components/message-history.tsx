import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { Sparkles, User, Box } from 'lucide-react';
import { cx } from '../utilities/cx';

interface MessageHistoryProps {
    messages: ChatMessage[];
    streamingMessage?: string;
    activeTools?: string[];
}

export const MessageHistory = ({ messages, streamingMessage, activeTools }: MessageHistoryProps) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingMessage]);

    return (
        <div className="flex-1 overflow-y-auto px-4 py-8 space-y-8 ag-scroll">
            {messages.length === 0 && !streamingMessage && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                    <Sparkles className="w-12 h-12 text-[var(--accent)]" />
                    <p className="text-sm font-medium">Hello there! <br /> I'm your task management assistant.</p>
                </div>
            )}

            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={cx(
                        "flex flex-col space-y-3 animate-fade-in",
                        msg.role === 'user' ? "items-end" : "items-start"
                    )}
                >
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black opacity-50">
                        {msg.role === 'user' ? (
                            <>You <User className="w-3 h-3" /></>
                        ) : (
                            <><Sparkles className="w-3 h-3 text-[var(--accent)]" /> Assistant</>
                        )}
                    </div>

                    <div className={cx(
                        "max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed",
                        msg.role === 'user'
                            ? "bg-[var(--accent)] text-white rounded-tr-none"
                            : "ag-glass text-[var(--text-primary)] rounded-tl-none"
                    )}>
                        {msg.content}
                    </div>

                    {msg.tools && msg.tools.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {msg.tools.map((tool, i) => (
                                <div key={i} className="flex items-center gap-1 text-[10px] bg-[var(--bg-secondary)] border border-[var(--border)] px-2 py-1 rounded-full text-[var(--text-secondary)]">
                                    <Box className="w-3 h-3" /> {tool}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}

            {streamingMessage && (
                <div className="flex flex-col space-y-3 items-start animate-fade-in">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black opacity-50">
                        <Sparkles className="w-3 h-3 text-[var(--accent)]" /> Assistant (Thinking...)
                    </div>
                    <div className="max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed ag-glass text-[var(--text-primary)] rounded-tl-none border-l-2 border-[var(--accent)]">
                        {streamingMessage}
                    </div>
                </div>
            )}

            {activeTools && activeTools.length > 0 && (
                <div className="flex flex-col space-y-3 items-start animate-fade-in">
                    <div className="flex flex-wrap gap-2">
                        {activeTools.map((tool, i) => (
                            <div key={i} className="flex items-center gap-1 text-[10px] bg-[var(--accent)]/10 border border-[var(--accent)]/30 px-2 py-1 rounded-full text-[var(--accent)] animate-pulse">
                                <Box className="w-3 h-3" /> Working: {tool}...
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div ref={bottomRef} h-1 />
        </div>
    );
};
