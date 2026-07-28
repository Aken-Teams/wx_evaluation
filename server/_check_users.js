import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

try {
  // 1. 检查数据库中所有用户
  const users = await prisma.user.findMany()
  console.log('\n=== 数据库中的用户记录 ===')
  console.log('用户数量:', users.length)
  if (users.length === 0) {
    console.log('⚠️  数据库中没有用户! ensureAdminSeed 可能未执行或失败')
  }
  for (const u of users) {
    console.log('  - id:', u.id, 'username:', u.username, 'role:', u.role, 'enabled:', u.enabled)
    console.log('    password hash (first 20):', u.password.substring(0, 20) + '...')
    console.log('    hash length:', u.password.length)
  }

  // 2. 如果有 admin 用户，测试密码匹配
  const admin = users.find(u => u.username === 'admin')
  if (admin) {
    console.log('\n=== 测试密码匹配 ===')
    const testPasswords = ['admin123', 'admin', 'Admin@123', '123456']
    for (const pw of testPasswords) {
      const ok = await bcrypt.compare(pw, admin.password)
      console.log('  密码 "' + pw + '" 匹配结果:', ok)
    }
  } else {
    console.log('\n⚠️  没有 admin 用户!')
  }

  console.log('\n=== 诊断完成 ===')
} catch (err) {
  console.log('❌ 查询错误:', err.message)
} finally {
  await prisma.()
}
