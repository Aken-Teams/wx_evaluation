import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './suppliers.controller';

export const suppliersRouter = Router();

suppliersRouter.use(authenticate);

// 檢視：所有登入者
suppliersRouter.get('/', ctrl.list);
suppliersRouter.get('/:id/profile', validate(ctrl.idParamSchema, 'params'), ctrl.getProfile);
suppliersRouter.get('/:id', validate(ctrl.idParamSchema, 'params'), ctrl.getOne);

// 維護：管理員 / 品質年度編輯
const canEdit = requireRole('admin', 'quality_yearly_editor');

suppliersRouter.post('/', canEdit, validate(ctrl.supplierSchema), ctrl.create);
suppliersRouter.post('/batch', canEdit, validate(ctrl.batchSchema), ctrl.batch);
suppliersRouter.put('/:id', validate(ctrl.idParamSchema, 'params'), canEdit, validate(ctrl.supplierSchema), ctrl.update);
suppliersRouter.delete('/:id', validate(ctrl.idParamSchema, 'params'), canEdit, ctrl.remove);
