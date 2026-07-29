import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './evaluations.controller';

export const evaluationsRouter = Router();

evaluationsRouter.use(authenticate);

// 檢視：所有登入者
evaluationsRouter.get(
  '/:year/:quarter',
  validate(ctrl.periodParamSchema, 'params'),
  ctrl.getQuarterly,
);

// 儲存：僅工程師（評核者）與管理員
evaluationsRouter.put(
  '/:year/:quarter',
  validate(ctrl.periodParamSchema, 'params'),
  requireRole('admin', 'quality_yearly_editor', 'engineer'),
  validate(ctrl.saveBodySchema, 'body'),
  ctrl.saveQuarterly,
);
