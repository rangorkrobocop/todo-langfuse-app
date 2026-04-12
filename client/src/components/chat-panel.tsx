import React from 'react';
import { MessageHistory } from './message-history';
import { IntentBar } from './intent-bar';
import { ChatMessage } from '../types';

interface ChatPanelProps {
    messages: ChatMessage[];
    streamingMessage?: string;
    activeTools?: string[];
    onSendMessage: (message: string) => Promise<void>;
    isLoading: boolean;
}

export const ChatPanel = ({
    messages,
    streamingMessage,
    activeTools,
    onSendMessage,
    isLoading
}: ChatPanelProps) => {
    return (
        <div className="ag-sidebar-chat ag-glass rounded-[2rem] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between bg-white/50 dark:bg-black/20">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[var(--accent)]">
                    Bee Command Center
                </h3>
                <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-400/50" />
                    <div className="w-2 h-2 rounded-full bg-amber-400/50" />
                    <div className="w-2 h-2 rounded-full bg-emerald-400/50" />
                </div>
            </div>

            <MessageHistory
                messages={messages}
                streamingMessage={streamingMessage}
                activeTools={activeTools}
            />

            <div className="p-6 bg-white/50 dark:bg-black/20 border-t border-[var(--border)]">
                <IntentBar onSendMessage={onSendMessage} isLoading={isLoading} />
            </div>
        </div>
    );
};
