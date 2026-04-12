import chalk from 'chalk';
import 'dotenv/config';

import { getDatabase } from './database.js';
import { createServer } from './server.js';

/**
 * Server Entry Point
 * Initializes the SQLite database, configures the Express server, 
 * and starts the HTTP listener on port 4001.
 */
const database = await getDatabase();
const server = await createServer(database);

const PORT = 4001;

server.listen(PORT, () => {
  const url = chalk.blue(`http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(chalk.green(`Server is running on ${url}.`));
});
