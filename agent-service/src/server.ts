import cors from 'cors';
import express from 'express';

/**
 * Agent Service Server Configuration.
 * Single route: POST /api/agent — runs the Gemini+MCP agentic loop.
 */
export async function createServer() {
  const app = express();

  app.use(cors({ origin: '*' }));

  app.post('/api/agent', express.json(), async (req, res) => {
    const { intent } = req.body;
    if (!intent) return res.status(400).json({ message: 'Intent is required' });

    const { handleAgentAction } = await import('./agent.js');
    await handleAgentAction(intent, res);
  });

  return app;
}
