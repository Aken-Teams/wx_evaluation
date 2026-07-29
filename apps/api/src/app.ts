import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/error';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { annualRouter } from './modules/annual/annual.routes';
import { authRouter } from './modules/auth/auth.routes';
import { backgroundRouter } from './modules/background/background.routes';
import { evaluationsRouter } from './modules/evaluations/evaluations.routes';
import { osatRouter } from './modules/osat/osat.routes';
import { scoringConfigRouter } from './modules/scoring-config/scoring-config.routes';
import { sourcingRouter } from './modules/sourcing/sourcing.routes';
import { suppliersRouter } from './modules/suppliers/suppliers.routes';
import { usersRouter } from './modules/users/users.routes';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : true }));
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/evaluations/quarterly', evaluationsRouter);
  app.use('/api/evaluations/annual', annualRouter);
  app.use('/api/osat', osatRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/scoring-config', scoringConfigRouter);
  app.use('/api/background', backgroundRouter);
  app.use('/api/sourcing', sourcingRouter);

  // 統一錯誤處理（須放在所有路由之後）
  app.use(errorHandler);
  return app;
};
