import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as service from './sourcing.service';

export const sourcingRouter = Router();

const editor = requireRole('admin', 'quality_yearly_editor', 'purchase_editor');

const idParam = z.object({ id: z.coerce.number().int().positive() });
const eventSchema = z.object({
  title: z.string().min(1, '请输入案件名称'),
  itemName: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
});
const quoteSchema = z.object({
  supplierName: z.string().min(1, '请输入供方名称'),
  stage: z.enum(['before', 'after']).optional(),
  moldItems: z.string().nullable().optional(),
  moldPriceTaxed: z.number().nullable().optional(),
  productUnitPrice: z.number().nullable().optional(),
  unitPriceTotal: z.number().nullable().optional(),
  sampleLeadTime: z.string().nullable().optional(),
  deliveryCycle: z.string().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  moldPaymentTerms: z.string().nullable().optional(),
  priceTier: z.string().nullable().optional(),
  backgroundInfo: z.string().nullable().optional(),
  evaluation: z.string().nullable().optional(),
});

const h =
  (fn: (req: import('express').Request) => Promise<unknown>): import('express').RequestHandler =>
  async (req, res, next) => {
    try {
      res.json(await fn(req));
    } catch (e) {
      next(e);
    }
  };

sourcingRouter.use(authenticate);

// 案件
sourcingRouter.get('/events', h(() => service.listEvents()));
sourcingRouter.post('/events', editor, validate(eventSchema), h((req) => service.createEvent(req.body)));
sourcingRouter.get('/events/:id', validate(idParam, 'params'), h((req) => service.getEvent(Number(req.params.id))));
sourcingRouter.put('/events/:id', validate(idParam, 'params'), editor, validate(eventSchema), h((req) => service.updateEvent(Number(req.params.id), req.body)));
sourcingRouter.delete('/events/:id', validate(idParam, 'params'), editor, h((req) => service.deleteEvent(Number(req.params.id))));

// 報價
sourcingRouter.post('/events/:id/quotes', validate(idParam, 'params'), editor, validate(quoteSchema), h((req) => service.addQuote(Number(req.params.id), req.body)));
sourcingRouter.put('/quotes/:id', validate(idParam, 'params'), editor, h((req) => service.updateQuote(Number(req.params.id), req.body)));
sourcingRouter.delete('/quotes/:id', validate(idParam, 'params'), editor, h((req) => service.deleteQuote(Number(req.params.id))));
sourcingRouter.post('/quotes/:id/best', validate(idParam, 'params'), editor, h((req) => service.markBest(Number(req.params.id))));
