import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as service from './users.service';
import { ROLES } from './users.service';

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const createSchema = z.object({
  username: z.string().min(1, '请输入账号'),
  password: z.string().min(6, '密码至少 6 码'),
  role: z.enum(ROLES),
});

export const updateSchema = z.object({
  role: z.enum(ROLES).optional(),
  enabled: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6, '新密码至少 6 码'),
});

export const list: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.listUsers());
  } catch (e) {
    next(e);
  }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json(await service.createUser(req.body as z.infer<typeof createSchema>));
  } catch (e) {
    next(e);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
    res.json(await service.updateUser(id, req.body as z.infer<typeof updateSchema>));
  } catch (e) {
    next(e);
  }
};

export const reset: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
    res.json(await service.resetPassword(id));
  } catch (e) {
    next(e);
  }
};

export const changePassword: RequestHandler = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;
    res.json(await service.changePassword(req.user!.id, oldPassword, newPassword));
  } catch (e) {
    next(e);
  }
};
