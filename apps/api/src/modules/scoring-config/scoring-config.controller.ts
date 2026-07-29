import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as service from './scoring-config.service';

const gradeThreshold = z.object({ grade: z.enum(['A', 'B', 'C', 'D', 'E']), gt: z.number() });

export const configSchema = z.object({
  larLadder: z.array(z.object({ min: z.number(), score: z.number() })).min(1),
  larScoreBelow: z.number(),
  carBase: z.number(),
  carCoeff: z.object({
    externalCAR: z.number(),
    arr: z.number(),
    untimelyResponseCCR: z.number(),
  }),
  deliveryDeductionLadder: z.array(z.object({ min: z.number(), deduction: z.number() })).min(1),
  deliveryDeductionBelow: z.number(),
  purchaseBase: z.number(),
  productionLineStopCoeff: z.number(),
  gradeThresholds: z.object({ nonAU: z.array(gradeThreshold).min(1), AU: z.array(gradeThreshold).min(1) }),
  downgradeQcThreshold: z.number(),
  downgradePurchaseThreshold: z.number(),
});

export const get: RequestHandler = async (_req, res, next) => {
  try {
    res.json({ config: await service.getConfig(), defaults: service.defaultConfig });
  } catch (e) {
    next(e);
  }
};

export const put: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.saveConfig(req.body as z.infer<typeof configSchema>));
  } catch (e) {
    next(e);
  }
};

export const reset: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.resetConfig());
  } catch (e) {
    next(e);
  }
};
