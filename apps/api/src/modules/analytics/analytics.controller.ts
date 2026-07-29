import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as service from './analytics.service';

export const periodParamSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
});

export const yearParamSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export const periods: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.getAvailablePeriods());
  } catch (e) {
    next(e);
  }
};

export const summary: RequestHandler = async (req, res, next) => {
  try {
    const { year, quarter } = req.params as unknown as z.infer<typeof periodParamSchema>;
    res.json(await service.getSummary(year, quarter));
  } catch (e) {
    next(e);
  }
};

export const trend: RequestHandler = async (req, res, next) => {
  try {
    const { year } = req.params as unknown as z.infer<typeof yearParamSchema>;
    res.json(await service.getTrend(year));
  } catch (e) {
    next(e);
  }
};
