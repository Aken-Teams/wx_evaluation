import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

type Source = 'body' | 'query' | 'params';

/**
 * zod 驗證中介層。驗證通過後以「解析後」的資料（含預設值/型別轉換）覆寫來源，
 * 讓後續 handler 直接拿到乾淨、具型別的輸入。
 */
export const validate =
  (schema: ZodSchema, source: Source = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    Object.assign(req, { [source]: result.data });
    next();
  };
