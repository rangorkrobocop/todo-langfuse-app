import cors from 'cors';
import express from 'express';

import { handleError } from './handle-error.js';

/**
 * Tasks Service Server Configuration.
 * Defines standard CRUD endpoints for tasks.
 */
export async function createServer(database: any) {
  const app = express();
  app.use((req, res, next) => { console.log(`[TASKS-SERVICE] ${req.method} ${req.url}`); next(); });
  app.use(cors());
  app.use(express.json());

  // Statement pre-compilation
  const incompleteTasks = await database.prepare('SELECT * FROM tasks whERE completed = 0');
  const completedTasks = await database.prepare('SELECT * FROM tasks WHERE completed = 1');
  const getTask = await database.prepare('SELECT * FROM tasks WHERE id = ?');
  const createTask = await database.prepare('INSERT INTO tasks (title, description) VALUES (?, ?)');
  const deleteTask = await database.prepare('DELETE FROM tasks WHERE id = ?');
  const updateTask = await database.prepare(
    `UPDATE tasks SET title = ?, description = ?, completed = ? WHERE id = ?`,
  );

  /** List tasks based on completion status */
  app.get('/tasks', async (req, res) => {
    const { completed } = req.query;
    const query = completed === 'true' ? completedTasks : incompleteTasks;

    try {
      const tasks = await query.all();
      return res.json(tasks);
    } catch (error) {
      return handleError(req, res, error);
    }
  });

  /** Fetch a specific task by ID */
  app.get('/tasks/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const task = await getTask.get([id]);

      if (!task) return res.status(404).json({ message: 'Task not found' });

      return res.json(task);
    } catch (error) {
      return handleError(req, res, error);
    }
  });

  /** Create a new task manually from the UI */
  app.post('/tasks', async (req, res) => {
    try {
      const task = req.body;
      if (!task.title) return res.status(400).json({ message: 'Title is required' });

      await createTask.run([task.title, task.description]);
      return res.status(201).json({ message: 'Task created successfully!' });
    } catch (error) {
      return handleError(req, res, error);
    }
  });

  /** Update an existing task's properties */
  app.put('/tasks/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const previous = await getTask.get([id]);
      const updates = req.body;
      const task = { ...previous, ...updates };

      await updateTask.run([task.title, task.description, task.completed ? 1 : 0, id]);
      return res.status(200).json({ message: 'Task updated successfully' });
    } catch (error) {
      return handleError(req, res, error);
    }
  });

  /** Delete a task by ID */
  app.delete('/tasks/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await deleteTask.run([id]);
      return res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
      return handleError(req, res, error);
    }
  });

  return app;
}
