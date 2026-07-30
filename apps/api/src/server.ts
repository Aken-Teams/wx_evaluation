import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './db/prisma';

const start = async () => {
  const dbLabel = env.NODE_ENV === 'production' ? '正式庫(無錫)' : '測試庫';
  // eslint-disable-next-line no-console
  console.log(`🔌 連線資料庫 [${dbLabel}] ${env.databaseUrlMasked}`);
  await prisma.$connect();
  // eslint-disable-next-line no-console
  console.log('✅ 資料庫連線成功');

  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`✅ API 運行於 http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
};

start().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('❌ 啟動失敗:', e);
  process.exit(1);
});
