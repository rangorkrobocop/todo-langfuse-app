import { useSearchParams } from '@/utilities/use-search-params';
import { cx } from 'class-variance-authority';
import { ThemeToggle } from './theme-toggle';

const activeClass = cx(
  'text-[var(--accent)] border-b-2 border-[var(--accent)]',
);

export const Header = () => {
  const [searchParams] = useSearchParams();
  const completed = searchParams.get('completed') === 'true';

  return (
    <header className="mb-12 flex items-center justify-between py-6 px-1 ag-glass rounded-2xl mx-auto max-w-4xl backdrop-blur-md sticky top-4 z-50 px-8" role="banner">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-[var(--accent)] rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-xl">B</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">Busy Bee</h1>
      </div>
      <nav className="flex items-center gap-6" aria-label="Filter tasks">
        <a
          href="/"
          className={cx('text-sm font-semibold transition-all hover:text-[var(--accent)]', !completed ? activeClass : 'text-[var(--text-secondary)]')}
        >
          Incomplete
        </a>
        <a
          href="/?completed=true"
          className={cx('text-sm font-semibold transition-all hover:text-[var(--accent)]', completed ? activeClass : 'text-[var(--text-secondary)]')}
        >
          Completed
        </a>
      </nav>
      <ThemeToggle />
    </header>
  );
};
