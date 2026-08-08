import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DEV = 'mysql://A999:1023@sharemysql.theaken.com:33333/wx_vendor';
const PROD = 'mysql://vendor_rw:123456@127.0.0.1:3306/vendor_assessment';

const dev = new PrismaClient({ datasources: { db: { url: DEV } } });
const prod = new PrismaClient({ datasources: { db: { url: PROD } } });

try {
  // 1) 讀測試庫的 evaluator 角色（以測試庫為準）
  const devUser = await dev.user.findUnique({ where: { username: 'evaluator' } });
  console.log('DEV evaluator =', devUser ? { username: devUser.username, role: devUser.role, enabled: devUser.enabled } : 'NOT FOUND');

  const role = devUser?.role || 'quality_yearly_editor';

  // 2) 正式庫現況
  const before = await prod.user.findMany({ select: { username: true, role: true, enabled: true }, orderBy: { username: 'asc' } });
  console.log('PROD users (before) =', before);

  const exists = before.some((u) => u.username === 'evaluator');
  if (exists) {
    console.log('→ evaluator 已存在於正式庫，未變更。');
  } else {
    const password = await bcrypt.hash('eval123', 10);
    const created = await prod.user.create({
      data: { username: 'evaluator', password, role, enabled: true },
      select: { id: true, username: true, role: true, enabled: true },
    });
    console.log('→ 已新增 evaluator 到正式庫 =', created);
  }

  const after = await prod.user.findMany({ select: { username: true, role: true, enabled: true }, orderBy: { username: 'asc' } });
  console.log('PROD users (after) =', after);
} catch (e) {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await dev.$disconnect();
  await prod.$disconnect();
}
