import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as service from './osat.service';

export const osatRouter = Router();

const periodParam = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

osatRouter.use(authenticate);

osatRouter.get('/periods', async (_req, res, next) => {
  try {
    res.json(await service.getPeriods());
  } catch (e) {
    next(e);
  }
});

osatRouter.get('/monthly/:year/:month', validate(periodParam, 'params'), async (req, res, next) => {
  try {
    const { year, month } = req.params as unknown as z.infer<typeof periodParam>;
    const factory = typeof req.query.factory === 'string' ? req.query.factory : undefined;
    res.json(await service.getMonthly(year, month, factory));
  } catch (e) {
    next(e);
  }
});
