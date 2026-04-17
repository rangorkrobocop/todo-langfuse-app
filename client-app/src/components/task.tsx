import { useTasks } from '@/contexts/task-context';
import type { Task as TaskItem } from '@/types';
import { useToggle } from '@/utilities/use-toggle';
import { Button } from './button';
import { TaskForm } from './task-form';
import { cx } from '@/utilities/cx';

export const Task = (task: TaskItem) => {
  const { deleteTask, updateTask } = useTasks();
  const [editing, toggleEditing] = useToggle();

  return (
    <li
      id={`task-${task.id}`}
      className="ag-card animate-fade-in group"
      aria-labelledby={`task-title-${task.id}`}
    >
      <article
        className="flex items-center justify-between gap-6"
        onKeyDown={(e) => {
          if (e.key === 'Delete') {
            deleteTask(task.id.toString());
          }
        }}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex items-center justify-center">
            <input
              type="checkbox"
              className="peer h-6 w-6 cursor-pointer appearance-none rounded-md border-2 border-[var(--border)] transition-all checked:bg-[var(--accent)] checked:border-[var(--accent)]"
              onChange={() => {
                updateTask(task.id.toString(), {
                  completed: !task.completed,
                });
              }}
              checked={task.completed}
              aria-labelledby={`task-title-${task.id}`}
              aria-label={`Mark ${task.title} as ${task.completed ? 'incomplete' : 'complete'}`}
            />
            <svg
              className="absolute h-4 w-4 pointer-events-none opacity-0 peer-checked:opacity-100 text-white transition-opacity"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="w-full">
            <h3
              id={`task-title-${task.id}`}
              className={cx(
                "text-lg font-bold tracking-tight transition-all",
                task.completed ? "text-[var(--text-secondary)] line-through" : "text-[var(--text-primary)]"
              )}
            >
              {task.title}
            </h3>
            {task.description && (
              <p className="text-sm text-[var(--text-secondary)] mt-1">{task.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            onClick={toggleEditing}
            className="!p-2 h-9 w-9 flex items-center justify-center"
            aria-label={`Edit task: ${task.title}`}
          >
            {editing ? '×' : '✎'}
          </Button>
          <Button
            variant="destructive"
            aria-label={`Delete task: ${task.title}`}
            className="!p-2 h-9 w-9 flex items-center justify-center"
            onClick={() => deleteTask(task.id.toString())}
          >
            🗑
          </Button>
        </div>
      </article>

      {editing && <TaskForm task={task} onSubmit={toggleEditing} />}
    </li>
  );
};
