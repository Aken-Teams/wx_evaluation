import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/error';
import { authRouter } from './modules/auth/auth.routes';
import { evaluationsRouter } from './modules/evaluations/evaluations.routes';
import { suppliersRouter } from './modules/suppliers/suppliers.routes';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : true }));
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
  app.use('/api/auth', authRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/evaluations/quarterly', evaluationsRouter);

  // 統一錯誤處理（須放在所有路由之後）
  app.use(errorHandler);
  return app;
};
