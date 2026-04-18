import cors from 'cors';
import express from 'express';

const TASKS_SERVICE_URL = process.env.TASKS_SERVICE_URL || 'http://localhost:4002';
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:4005';

/**
 * BFF Server Configuration.
 * Thin gateway: proxies CRUD to Tasks Service, pipes SSE from Agent Service.
 */
export async function createServer() {
  console.log('TASKS_SERVICE_URL:', TASKS_SERVICE_URL);
  console.log('AGENT_SERVICE_URL:', AGENT_SERVICE_URL);
  const app = express();

  // CORS first
  app.use(cors({ origin: '*' }));

  /**
   * Proxy standard CRUD operations to Tasks Service
   */
  app.use('/tasks', express.json(), async (req, res) => {
    try {
      const url = `${TASKS_SERVICE_URL}${req.originalUrl}`;
      const options: RequestInit = {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        options.body = JSON.stringify(req.body);
      }

      console.log(`[BFF Proxy] ${req.method} ${req.originalUrl} -> ${url}`);

      const response = await fetch(url, options);

      const responseData = await response.text();
      res.status(response.status).send(responseData);
    } catch (error) {
      console.error('[BFF Proxy Error]', error);
      res.status(500).json({ message: 'Proxy Error' });
    }
  });

  /**
   * SSE proxy — pipe Agent Service stream directly to client
   */
  app.post('/api/agent', express.json(), async (req, res) => {
    const { intent } = req.body;
    if (!intent) return res.status(400).json({ message: 'Intent is required' });

    const response = await fetch(`${AGENT_SERVICE_URL}/api/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent })
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.status(200);

    const { Readable } = await import('stream');
    Readable.fromWeb(response.body as any).pipe(res);
  });

  return app;
}
