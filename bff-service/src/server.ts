import cors from 'cors';
import express from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

import { handleError } from './handle-error.js';

const TASKS_SERVICE_URL = process.env.TASKS_SERVICE_URL || 'http://localhost:4002';

/**
 * BFF Server Configuration.
 * Acts as an API Gateway for the frontend and handles Agent Interactions.
 * Proxies standard CRUD operations to the dedicated Tasks Service.
 */
export async function createServer() {
  console.log('TASKS_SERVICE_URL:', TASKS_SERVICE_URL);
  const app = express();
  
  // 1. Move CORS to the top, allow all
  app.use(cors({ origin: '*' }));

  /** 
   * Proxy standard CRUD operations to Tasks Service
   * Manually parsing and forwarding to completely bypass http-proxy-middleware quirks.
   */
  app.use('/tasks', express.json(), async (req, res) => {
    try {
      // req.originalUrl contains the full path including query string like '/tasks?completed=true'
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
   * 3. Agent Intelligence Endpoint (SSE)
   * We only apply body parsing specifically to this route.
   */
  app.post('/api/agent', express.json(), async (req, res) => {
    const { intent } = req.body;
    if (!intent) return res.status(400).json({ message: 'Intent is required' });

    // Dynamic import to keep main bundle light
    const { handleAgentAction } = await import('./agent.js');
    await handleAgentAction(intent, res);
  });

  return app;
}
