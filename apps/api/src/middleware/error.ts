import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/httpError';

/**
 * 統一錯誤處理 — 取代舊系統各 handler 手寫 try/catch 且外洩 e.message 的做法。
 * 已知錯誤回傳明確訊息；未預期錯誤僅回 500，不外洩內部細節。
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: '輸入驗證失敗', details: err.flatten() });
  }
  // eslint-disable-next-line no-console
  console.error('未預期錯誤:', err);
  return res.status(500).json({ error: '伺服器內部錯誤' });
};
