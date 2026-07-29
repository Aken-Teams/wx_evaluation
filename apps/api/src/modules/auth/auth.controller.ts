import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';

export const loginSchema = z.object({
  username: z.string().min(1, '請輸入帳號'),
  password: z.string().min(1, '請輸入密碼'),
});

export const login: RequestHandler = async (req, res, next) => {
  try {
    const { username, password } = req.body as z.infer<typeof loginSchema>;
    res.json(await authService.login(username, password));
  } catch (e) {
    next(e);
  }
};

export const me: RequestHandler = (req, res) => {
  res.json({ user: req.user });
};
