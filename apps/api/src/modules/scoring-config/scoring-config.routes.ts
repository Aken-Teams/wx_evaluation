import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './scoring-config.controller';

export const scoringConfigRouter = Router();

scoringConfigRouter.use(authenticate);

// 檢視：所有登入者
scoringConfigRouter.get('/', ctrl.get);

// 調整：僅管理員
const admin = requireRole('admin');
scoringConfigRouter.put('/', admin, validate(ctrl.configSchema), ctrl.put);
scoringConfigRouter.post('/reset', admin, ctrl.reset);
