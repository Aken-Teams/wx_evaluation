import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './analytics.controller';

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);
analyticsRouter.get('/periods', ctrl.periods);
analyticsRouter.get('/summary/:year/:quarter', validate(ctrl.periodParamSchema, 'params'), ctrl.summary);
analyticsRouter.get('/trend/:year', validate(ctrl.yearParamSchema, 'params'), ctrl.trend);
