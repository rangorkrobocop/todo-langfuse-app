import chalk from 'chalk';
import 'dotenv/config';

import { createServer } from './server.js';

/**
 * Agent Service Entry Point
 * Handles AI orchestration: Gemini + MCP loop + Langfuse tracing.
 */
const server = await createServer();

const PORT = process.env.PORT || 4005;

server.listen(PORT, () => {
  const url = chalk.blue(`http://localhost:${PORT}`);
  console.log(chalk.green(`Agent Service is running on ${url}.`));
});
