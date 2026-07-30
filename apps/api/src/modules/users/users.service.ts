import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { badRequest, notFound, unauthorized } from '../../lib/httpError';

export const ROLES = ['admin', 'quality_yearly_editor', 'purchase_editor', 'engineer', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

const publicFields = {
  id: true,
  username: true,
  role: true,
  enabled: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const listUsers = () =>
  prisma.user.findMany({ orderBy: { username: 'asc' }, select: publicFields });

export const createUser = async (data: { username: string; password: string; role: Role }) => {
  try {
    const password = await bcrypt.hash(data.password, 10);
    return await prisma.user.create({
      data: { username: data.username, password, role: data.role, enabled: true },
      select: publicFields,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      throw badRequest('账号已存在');
    throw e;
  }
};

export const updateUser = async (id: number, data: { role?: Role; enabled?: boolean }) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('找不到该账号');
  return prisma.user.update({ where: { id }, data, select: publicFields });
};

/**
 * 管理員重置/設定密碼：
 * - 提供 newPassword → 設為指定密碼（管理員特權，不需舊密碼）
 * - 未提供 → 產生密碼學安全的臨時密碼並回傳
 */
export const resetPassword = async (id: number, newPassword?: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('找不到该账号');
  if (newPassword) {
    await prisma.user.update({ where: { id }, data: { password: await bcrypt.hash(newPassword, 10) } });
    return { tempPassword: null as string | null };
  }
  const temp = (await import('node:crypto')).randomBytes(6).toString('base64url');
  await prisma.user.update({ where: { id }, data: { password: await bcrypt.hash(temp, 10) } });
  return { tempPassword: temp as string | null };
};

export const changePassword = async (userId: number, oldPassword: string, newPassword: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('找不到该账号');
  if (!(await bcrypt.compare(oldPassword, user.password))) throw unauthorized('原密码错误');
  await prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(newPassword, 10) } });
  return { ok: true };
};
