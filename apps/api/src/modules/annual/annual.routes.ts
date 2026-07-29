import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './annual.controller';

export const annualRouter = Router();

annualRouter.use(authenticate);

annualRouter.get('/:year', validate(ctrl.yearParamSchema, 'params'), ctrl.get);
annualRouter.put(
  '/:year',
  validate(ctrl.yearParamSchema, 'params'),
  requireRole('admin', 'quality_yearly_editor'),
  validate(ctrl.saveSchema, 'body'),
  ctrl.save,
);
