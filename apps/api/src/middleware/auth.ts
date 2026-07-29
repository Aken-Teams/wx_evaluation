import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { forbidden, unauthorized } from '../lib/httpError';

export interface JwtUser {
  id: number;
  username: string;
  role: string;
}

export const signToken = (user: JwtUser): string =>
  jwt.sign(user, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);

/** 驗證 Bearer token，將使用者掛到 req.user */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized('缺少認證 token'));
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as JwtUser;
    req.user = { id: payload.id, username: payload.username, role: payload.role };
    next();
  } catch {
    next(unauthorized('token 無效或已過期'));
  }
};

/**
 * 角色守門（唯一的權限檢查寫法，取代舊系統 3 種混用）。
 * 後端強制驗證，前端角色不可信。
 */
export const requireRole =
  (...roles: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
