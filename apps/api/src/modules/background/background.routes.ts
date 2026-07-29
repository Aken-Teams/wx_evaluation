import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as service from './background.service';

export const backgroundRouter = Router();

const yearParam = z.object({ year: z.coerce.number().int().min(2000).max(2100) });
const itemSchema = z.object({
  vendorId: z.number().int().positive(),
  latePaymentCount: z.number().int().nonnegative().default(0),
  customerComplaintCount: z.number().int().nonnegative().default(0),
  qualityAbnormal8D: z.number().int().nonnegative().default(0),
  cooperationScore: z.number().nullable().default(null),
  notes: z.string().nullable().optional(),
});
const saveSchema = z.object({ items: z.array(itemSchema).min(1) });

backgroundRouter.use(authenticate);

backgroundRouter.get('/:year', validate(yearParam, 'params'), async (req, res, next) => {
  try {
    res.json(await service.getByYear((req.params as unknown as z.infer<typeof yearParam>).year));
  } catch (e) {
    next(e);
  }
});

backgroundRouter.put(
  '/:year',
  validate(yearParam, 'params'),
  requireRole('admin', 'quality_yearly_editor'),
  validate(saveSchema, 'body'),
  async (req, res, next) => {
    try {
      const { year } = req.params as unknown as z.infer<typeof yearParam>;
      const { items } = req.body as z.infer<typeof saveSchema>;
      res.json(await service.saveByYear(year, items));
    } catch (e) {
      next(e);
    }
  },
);
