import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './suppliers.controller';

export const suppliersRouter = Router();

suppliersRouter.use(authenticate);
suppliersRouter.get('/', ctrl.list);
suppliersRouter.get('/:id', validate(ctrl.idParamSchema, 'params'), ctrl.getOne);
