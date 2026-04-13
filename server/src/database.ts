import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

// Singleton database instance
let databaseInstance: Awaited<ReturnType<typeof open>> | null = null;

export async function getDatabase(
  filename = process.env.NODE_ENV === 'test' ? ':memory:' : './database.sqlite',
  forceNew = false
) {
  // For tests, allow forcing a new database instance
  if (forceNew) {
    databaseInstance = null;
  }
  
  // Return the existing instance if it exists
  if (databaseInstance) {
    return databaseInstance;
  }
  
  // Create a new database connection with busy timeout to prevent SQLITE_BUSY errors
  const database = await open({
    filename,
    driver: sqlite3.Database,
  });
  
  // Set a busy timeout of 5000ms (5 seconds)
  await database.run('PRAGMA busy_timeout = 5000;');

  await database.exec(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT UNIQUE,
      description TEXT,
      completed BOOLEAN DEFAULT 0
    )
  `);

  // Ensure title is unique even if the table already existed before this change
  try {
    await database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title);');
  } catch (error) {
    console.warn('Could not create unique index on tasks.title. This may be due to existing duplicate titles.', error);
  }

  // Store the database instance
  databaseInstance = database;
  
  return database;
}
