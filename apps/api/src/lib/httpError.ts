/** 帶 HTTP 狀態碼的錯誤，供統一錯誤處理中介層辨識 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (m: string, code?: string) => new HttpError(400, m, code);
export const unauthorized = (m = '未授權', code?: string) => new HttpError(401, m, code);
export const forbidden = (m = '權限不足', code?: string) => new HttpError(403, m, code);
export const notFound = (m = '找不到資源', code?: string) => new HttpError(404, m, code);
