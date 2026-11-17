import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './server/app.js';
import { startConciergeSchedulers } from './server/conciergeEngine.js';
import { startVoiceStorageCleanupCron } from './server/voiceInboxStore.js';

function resolveServerPort(): number {
  const portFlagIdx = process.argv.indexOf('--port');
  if (portFlagIdx !== -1 && process.argv[portFlagIdx + 1]) {
    const parsed = Number(process.argv[portFlagIdx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (process.env.DEFAULT_APP_PORT) {
    const parsed = Number(process.env.DEFAULT_APP_PORT);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (
    process.env.PORT &&
    process.env.PORT !== process.env.NGINX_PORT &&
    process.env.NODE_ENV === 'production'
  ) {
    const parsed = Number(process.env.PORT);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 3000;
}

const PORT = resolveServerPort();

async function startServer() {
  const app = createApiApp(PORT);
  const httpServer = http.createServer(app);
  let viteInstance: Awaited<ReturnType<typeof createViteServer>> | null = null;

  if (process.env.NODE_ENV !== 'production') {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const viteReady = createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    })
      .then((v) => {
        viteInstance = v;
        return v;
      })
      .catch((err) => {
        console.error('Vite middleware initialization failed:', err);
        throw err;
      });

    app.use(async (req, res, next) => {
      try {
        const vite = viteInstance || (await viteReady);
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distDir = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.on('error', (err) => {
    console.error(`HTTP server error on port ${PORT}:`, err);
    process.exit(1);
  });

  const shutdown = async () => {
    try {
      await viteInstance?.close();
    } catch {
      // ignore close errors during shutdown
    }
    httpServer.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.once('SIGTERM', () => {
    void shutdown();
  });
  process.once('SIGINT', () => {
    void shutdown();
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`WORKCRAFT Local server listening on http://0.0.0.0:${PORT}`);
    setImmediate(() => {
      startConciergeSchedulers();
      startVoiceStorageCleanupCron();
    });
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start WORKCRAFT Local server:', err);
    process.exit(1);
  });
}

export default createApiApp;
