import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as service from './ai.service';

export const aiRouter = Router();

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1),
      }),
    )
    .min(1)
    .max(30),
});

aiRouter.use(authenticate);

aiRouter.get('/status', (_req, res) => {
  res.json({ configured: service.isConfigured() });
});

aiRouter.post('/chat', validate(chatSchema), async (req, res, next) => {
  try {
    const { messages } = req.body as z.infer<typeof chatSchema>;
    res.json(await service.chat(messages));
  } catch (e) {
    next(e);
  }
});
