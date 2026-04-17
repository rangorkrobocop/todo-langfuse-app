import { useTheme } from '../contexts/theme-context';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle = () => {
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <button
      onClick={toggleDarkMode}
      className="ag-button-secondary !p-2 !rounded-full w-10 h-10 flex items-center justify-center border-none shadow-sm hover:scale-110 active:scale-95 transition-all"
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDarkMode ? 'true' : 'false'}
      type="button"
    >
      {isDarkMode ? (
        <Sun className="h-5 w-5 text-yellow-500" />
      ) : (
        <Moon className="h-5 w-5 text-[var(--accent)]" />
      )}
    </button>
  );
};
