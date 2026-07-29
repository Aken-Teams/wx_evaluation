import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as service from './suppliers.service';

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const list: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.listSuppliers());
  } catch (e) {
    next(e);
  }
};

export const getOne: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
    res.json(await service.getSupplier(id));
  } catch (e) {
    next(e);
  }
};
