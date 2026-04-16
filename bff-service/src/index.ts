import chalk from 'chalk';
import 'dotenv/config';

import { createServer } from './server.js';

/**
 * BFF Server Entry Point
 * Configures the Express server as an API gateway.
 */
const server = await createServer();

const PORT = 4001;

server.listen(PORT, () => {
  const url = chalk.blue(`http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(chalk.green(`BFF Server is running on ${url}.`));
});
