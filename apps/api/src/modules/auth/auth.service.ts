import bcrypt from 'bcryptjs';
import { prisma } from '../../db/prisma';
import { signToken } from '../../middleware/auth';
import { unauthorized } from '../../lib/httpError';

export const login = async (username: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { username } });
  // 統一錯誤訊息，不洩漏「帳號存在但密碼錯」
  if (!user || !user.enabled) throw unauthorized('帳號或密碼錯誤');
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw unauthorized('帳號或密碼錯誤');

  const publicUser = { id: user.id, username: user.username, role: user.role };
  return { token: signToken(publicUser), user: publicUser };
};
