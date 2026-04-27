/**
 * Local development server. Mimics what `vercel dev` does:
 *   - Serves Vite (client HMR) on the same port
 *   - Routes /api/* to the Vercel-style serverless handlers
 *
 * Usage:  node dev-server.js          → http://localhost:3000
 *
 * In production on Vercel, this file is never used — Vercel handles
 * routing natively with vercel.json.
 */

import { createServer as createViteServer } from 'vite';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

async function start() {
  const app = express();
  app.use(express.json());

  // --- Load all API handlers at startup ---
  const handlers = {
    board:   (await import('./api/board.js')).default,
    create:  (await import('./api/room/create.js')).default,
    index:   (await import('./api/room/[code]/index.js')).default,
    join:    (await import('./api/room/[code]/join.js')).default,
    leave:   (await import('./api/room/[code]/leave.js')).default,
    start:   (await import('./api/room/[code]/start.js')).default,
    bot:     (await import('./api/room/[code]/bot.js')).default,
    action:  (await import('./api/room/[code]/action.js')).default,
    events:  (await import('./api/room/[code]/events.js')).default,
  };

  // Helper: wrap a Vercel-style handler for Express (maps req.params to req.query)
  function wrap(handler) {
    return async (req, res) => {
      req.query = { ...req.query, ...req.params };
      try {
        await handler(req, res);
      } catch (err) {
        console.error('API error:', err);
        if (!res.headersSent) {
          res.status(500).json({ ok: false, error: err.message || 'Internal server error' });
        }
      }
    };
  }

  // --- API routes ---
  app.get('/api/board', wrap(handlers.board));
  app.post('/api/room/create', wrap(handlers.create));
  app.get('/api/room/:code', wrap(handlers.index));
  app.post('/api/room/:code/join', wrap(handlers.join));
  app.post('/api/room/:code/leave', wrap(handlers.leave));
  app.post('/api/room/:code/start', wrap(handlers.start));
  app.post('/api/room/:code/bot', wrap(handlers.bot));
  app.post('/api/room/:code/action', wrap(handlers.action));
  app.get('/api/room/:code/events', wrap(handlers.events));

  // --- Vite dev server (client HMR) ---
  const vite = await createViteServer({
    root: resolve(__dirname, 'client'),
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  app.listen(PORT, () => {
    console.log(`\n  🏛️  Egypt Monopoly dev server running at:\n`);
    console.log(`     http://localhost:${PORT}\n`);
  });
}

start().catch(err => {
  console.error('Failed to start dev server:', err);
  process.exit(1);
});
