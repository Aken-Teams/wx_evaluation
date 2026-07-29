import 'express';

declare global {
  namespace Express {
    interface Request {
      /** 由 authenticate 中介層填入 */
      user?: { id: number; username: string; role: string };
    }
  }
}

export {};
