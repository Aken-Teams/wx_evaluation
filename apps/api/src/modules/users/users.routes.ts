import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as ctrl from './users.controller';

export const usersRouter = Router();

usersRouter.use(authenticate);

// 自助改密碼（所有登入者）
usersRouter.post('/change-password', validate(ctrl.changePasswordSchema), ctrl.changePassword);

// 帳號管理（僅管理員）
const admin = requireRole('admin');
usersRouter.get('/', admin, ctrl.list);
usersRouter.post('/', admin, validate(ctrl.createSchema), ctrl.create);
usersRouter.put('/:id', admin, validate(ctrl.idParamSchema, 'params'), validate(ctrl.updateSchema), ctrl.update);
usersRouter.post('/:id/reset-password', admin, validate(ctrl.idParamSchema, 'params'), ctrl.reset);
