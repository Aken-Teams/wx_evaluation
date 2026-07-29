import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as service from './evaluations.service';

export const periodParamSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
});

const evalItemSchema = z.object({
  vendorId: z.number().int().positive(),
  receivedQuantity: z.string().default('0'),
  returnedQuantity: z.string().default('0'),
  receivedBatches: z.number().int().nonnegative().default(0),
  returnedBatches: z.number().int().nonnegative().default(0),
  arr: z.number().nonnegative().default(0),
  lrr: z.number().nonnegative().default(0),
  externalCAR: z.number().nonnegative().default(0),
  untimelyResponseCCR: z.number().nonnegative().default(0),
  others: z.number().default(0),
  serviceQuality: z.number().default(0),
  lateDelivery: z.number().default(0),
  deliveryRate: z.number().nullable().default(null),
  specialApproval: z.number().default(0),
  productionLineStop: z.number().nonnegative().default(0),
  excessFreight: z.number().default(0),
  servicePurchase: z.number().default(0),
  remarks: z.string().nullable().optional(),
});

export const saveBodySchema = z.object({ items: z.array(evalItemSchema).min(1, '至少一筆') });

export const getQuarterly: RequestHandler = async (req, res, next) => {
  try {
    const { year, quarter } = req.params as unknown as z.infer<typeof periodParamSchema>;
    res.json(await service.getQuarterly(year, quarter));
  } catch (e) {
    next(e);
  }
};

export const saveQuarterly: RequestHandler = async (req, res, next) => {
  try {
    const { year, quarter } = req.params as unknown as z.infer<typeof periodParamSchema>;
    const { items } = req.body as z.infer<typeof saveBodySchema>;
    res.json(await service.saveQuarterly(year, quarter, items));
  } catch (e) {
    next(e);
  }
};
