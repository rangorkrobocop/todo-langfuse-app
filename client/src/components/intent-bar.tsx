import React, { useState } from 'react';
import { Sparkles, Loader2, CornerDownLeft } from 'lucide-react';
import { cx } from '../utilities/cx';

interface IntentBarProps {
  onSendMessage: (message: string) => Promise<void>;
  isLoading?: boolean;
}

export const IntentBar = ({ onSendMessage, isLoading }: IntentBarProps) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    await onSendMessage(inputValue);
    setInputValue('');
  };

  return (
    <div className="relative group w-full max-w-2xl mx-auto">
      <form
        onSubmit={handleSubmit}
        className={cx(
          "relative flex items-center transition-all duration-500 rounded-3xl p-1 ag-glass group-focus-within:ring-2 group-focus-within:ring-[var(--accent)] group-focus-within:ring-offset-0",
          isLoading ? "ring-2 ring-[var(--accent)] shadow-lg" : "shadow-sm hover:shadow-md"
        )}
      >
        <div className="pl-5 text-[var(--accent)]">
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
        </div>

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="What should we accomplish today?"
          className="w-full py-4 px-4 bg-transparent outline-none text-[var(--text-primary)] font-medium placeholder:text-[var(--text-secondary)] placeholder:font-normal"
          disabled={isLoading}
        />

        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="mr-2 p-3 rounded-2xl bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--accent)] hover:text-white transition-all duration-300 disabled:opacity-30 flex items-center justify-center transform hover:scale-105 active:scale-95"
        >
          <CornerDownLeft className="w-4 h-4" />
        </button>
      </form>

      <div className="mt-4 flex gap-4 justify-center">
        <span className="text-[10px] uppercase tracking-[0.2em] font-black text-[var(--text-secondary)] opacity-50">Shortcuts:</span>
        <button onClick={() => setInputValue("Clear all completed tasks")} className="text-[10px] font-bold text-[var(--accent)] hover:opacity-80 transition-opacity">"Clean Up"</button>
        <button onClick={() => setInputValue("What's on my plate today?")} className="text-[10px] font-bold text-[var(--accent)] hover:opacity-80 transition-opacity">"Briefing"</button>
      </div>
    </div>
  );
};