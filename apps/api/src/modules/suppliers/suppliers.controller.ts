import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as service from './suppliers.service';

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const supplierSchema = z.object({
  name: z.string().min(1, '请输入供应商名称'),
  supplierCode: z.string().nullable().optional(),
  materialCategory: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  isAU: z.string().nullable().optional(),
  vendorType: z.string().optional(),
});

export const batchSchema = z.object({ items: z.array(supplierSchema).min(1, '至少一笔') });

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

export const getProfile: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
    res.json(await service.getProfile(id));
  } catch (e) {
    next(e);
  }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json(await service.createSupplier(req.body as z.infer<typeof supplierSchema>));
  } catch (e) {
    next(e);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
    res.json(await service.updateSupplier(id, req.body as z.infer<typeof supplierSchema>));
  } catch (e) {
    next(e);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
    res.json(await service.deleteSupplier(id));
  } catch (e) {
    next(e);
  }
};

export const batch: RequestHandler = async (req, res, next) => {
  try {
    const { items } = req.body as z.infer<typeof batchSchema>;
    res.json(await service.batchUpsert(items));
  } catch (e) {
    next(e);
  }
};
