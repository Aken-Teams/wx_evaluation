import 'dotenv/config';
import { z } from 'zod';

/**
 * 環境變數集中驗證 — 缺關鍵值即 fail-fast（取代舊系統 JWT_SECRET 預設 'dev-secret' 的隱患）。
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  // 依 NODE_ENV 選用：production → DATABASE_URL_PROD；否則 → DATABASE_URL_DEV。
  // 兩者皆可退回舊的 DATABASE_URL（向後相容）。
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_DEV: z.string().optional(),
  DATABASE_URL_PROD: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET 必填且至少 16 字元（請勿使用弱密鑰）'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),
  // AI 問答（Ollama / OpenAI 相容）— 選用，未設定則優雅降級
  OLLAMA_API_URL: z.string().default(''),
  OLLAMA_API_KEY: z.string().default(''),
  OLLAMA_MODEL: z.string().default('llama3.2'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`❌ 環境變數設定錯誤：\n${issues}`);
  process.exit(1);
}

const data = parsed.data;

// 依模式決定實際使用的資料庫連線
const databaseUrl =
  data.NODE_ENV === 'production'
    ? data.DATABASE_URL_PROD || data.DATABASE_URL
    : data.DATABASE_URL_DEV || data.DATABASE_URL;

if (!databaseUrl) {
  const need = data.NODE_ENV === 'production' ? 'DATABASE_URL_PROD' : 'DATABASE_URL_DEV';
  // eslint-disable-next-line no-console
  console.error(`❌ 缺少資料庫連線：NODE_ENV=${data.NODE_ENV} 需要 ${need}（或退回 DATABASE_URL）`);
  process.exit(1);
}

/** 遮蔽連線字串中的密碼，供日誌顯示 */
const maskDbUrl = (url: string): string => url.replace(/:\/\/([^:]+):[^@]*@/, '://$1:***@');

export const env = { ...data, databaseUrl, databaseUrlMasked: maskDbUrl(databaseUrl) };
export type Env = typeof env;
