import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiRouter } from './src/server/api.ts';
import { loadConfig } from './src/server/config.ts';
import { AzureSqlHospitalRepository } from './src/server/repositories/azureSqlRepository.ts';
import { DemoHospitalRepository } from './src/server/repositories/demoRepository.ts';
import type { HospitalRepository } from './src/server/repositories/hospitalRepository.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer(): Promise<void> {
  const config = loadConfig();

  const repository: HospitalRepository =
    config.storageMode === 'azure_sql' && config.azureSql
      ? new AzureSqlHospitalRepository(config.azureSql)
      : new DemoHospitalRepository();

  await repository.initialize();

  const app = express();
  const httpServer = http.createServer(app);
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err && req.path.startsWith('/api')) {
      res.status(400).json({ error: 'Invalid JSON request payload.' });
      return;
    }
    next(err);
  });

  app.use('/api', createApiRouter(repository, config));

  if (config.nodeEnv !== 'production') {
    await new Promise<void>((resolve) => {
      httpServer.listen(config.port, '0.0.0.0', resolve);
    });

    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    const indexHtmlPath = path.resolve(distDir, 'index.html');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
    }
    app.get('*', (_req, res) => {
      if (fs.existsSync(indexHtmlPath)) {
        res.sendFile(indexHtmlPath);
      } else {
        res.status(404).send('Production build not found. Run npm run build first.');
      }
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(config.port, '0.0.0.0', resolve);
    });
  }

  const modeInfo = repository.getModeInfo();
  console.log(
    `[Hospital Management System] Listening on port ${config.port} | Mode: ${modeInfo.label} | Persistent: ${modeInfo.persistent}`
  );
}

startServer().catch((err) => {
  console.error('[Hospital Management System] Fatal startup error:', err);
  process.exit(1);
});
