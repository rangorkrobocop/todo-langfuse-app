import chalk from 'chalk';
import 'dotenv/config';

import { getDatabase } from './database.js';
import { createServer } from './server.js';

const PORT = process.env.PORT || 4002;

async function start() {
  const database = await getDatabase();
  const app = await createServer(database);

  app.listen(PORT, () => {
    const url = chalk.blue(`http://localhost:${PORT}`);
    // eslint-disable-next-line no-console
    console.log(chalk.green(`Tasks Service is running on ${url}.`));
  });
}

start().catch((err) => {
  console.error('Failed to start Tasks Service:', err);
  process.exit(1);
});
