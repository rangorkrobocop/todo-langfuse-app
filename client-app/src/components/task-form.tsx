import { ComponentProps, useState, type FormEventHandler } from 'react';

import { Button } from './button';
import { Input } from './input';

import { useTasks } from '@/contexts/task-context';
import { PartialTask, Task } from '@/types';
import { cx } from '@/utilities/cx';

type TaskFormProps = ComponentProps<'form'> & {
  task?: Task;
};

export const TaskForm = ({ task, onSubmit, className, ...props }: TaskFormProps) => {
  const { createTask, updateTask } = useTasks();

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();

    const data = new FormData(e.target as HTMLFormElement);
    const taskData = Object.fromEntries(data.entries()) as PartialTask;

    if (task) {
      updateTask(task.id.toString(), { ...task, ...taskData });
    } else {
      createTask(taskData);
    }

    if (onSubmit) onSubmit(e);

    // Reset form fields
    if (!task) {
      setTitle('');
      setDescription('');
    }
  };

  return (
    <form
      className={cx(
        'space-y-6',
        className,
      )}
      onSubmit={handleSubmit}
      aria-label={task ? 'Edit task' : 'Create new task'}
      {...props}
    >
      <Input
        label="Task Title"
        type="text"
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to be done?"
        required
      />

      <Input
        label="Description (Optional)"
        name="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add some details…"
      />

      <div aria-label="Form Controls" className="flex justify-end gap-3" role="group">
        <Button type="submit" variant="primary" className="w-full sm:w-auto">
          {task ? 'Update Task' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
};
