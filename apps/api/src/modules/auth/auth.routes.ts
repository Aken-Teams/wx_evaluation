import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './auth.controller';

export const authRouter = Router();

authRouter.post('/login', validate(ctrl.loginSchema), ctrl.login);
authRouter.get('/me', authenticate, ctrl.me);
