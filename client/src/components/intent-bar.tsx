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
    <div className="relative group w-full max-w-2xl mx-auto mb-8">
      <form
        onSubmit={handleSubmit}
        className={cx(
          "relative flex items-center transition-all duration-300 rounded-2xl border-2 p-1 bg-white dark:bg-slate-900",
          isLoading ? "border-amber-400 shadow-lg shadow-amber-100/50" : "border-slate-200 focus-within:border-amber-500 shadow-sm"
        )}
      >
        <div className="pl-4 text-amber-500">
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
          placeholder="Ask the Bee to organize your day..."
          className="w-full py-3 px-4 bg-transparent outline-none text-slate-700 dark:text-slate-100 placeholder:text-slate-400"
          disabled={isLoading}
        />

        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="mr-2 p-2 rounded-xl bg-slate-100 hover:bg-amber-500 hover:text-white transition-colors disabled:opacity-50"
        >
          <CornerDownLeft className="w-4 h-4" />
        </button>
      </form>

      <div className="mt-2 flex gap-2 justify-center">
        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Suggestions:</span>
        <button onClick={() => setInputValue("Clear all completed tasks")} className="text-[10px] text-amber-600 hover:underline">"Clear completed"</button>
        <button onClick={() => setInputValue("What's on my plate today?")} className="text-[10px] text-amber-600 hover:underline">"Daily Briefing"</button>
      </div>
    </div>
  );
};