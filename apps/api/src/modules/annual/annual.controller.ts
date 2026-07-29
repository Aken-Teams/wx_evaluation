import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as service from './annual.service';

export const yearParamSchema = z.object({ year: z.coerce.number().int().min(2000).max(2100) });

const itemSchema = z.object({
  vendorId: z.number().int().positive(),
  VDA: z.number().nullable().default(null),
  QSA: z.number().nullable().default(null),
  QPA: z.number().nullable().default(null),
  HSF: z.number().nullable().default(null),
  CSR: z.number().nullable().default(null),
  others: z.number().nullable().default(null),
  nextYearAuditType: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
});

export const saveSchema = z.object({ items: z.array(itemSchema).min(1) });

export const get: RequestHandler = async (req, res, next) => {
  try {
    const { year } = req.params as unknown as z.infer<typeof yearParamSchema>;
    res.json(await service.getAnnual(year));
  } catch (e) {
    next(e);
  }
};

export const save: RequestHandler = async (req, res, next) => {
  try {
    const { year } = req.params as unknown as z.infer<typeof yearParamSchema>;
    const { items } = req.body as z.infer<typeof saveSchema>;
    res.json(await service.saveAnnual(year, items));
  } catch (e) {
    next(e);
  }
};
