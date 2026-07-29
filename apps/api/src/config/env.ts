import 'dotenv/config';
import { z } from 'zod';

/**
 * 環境變數集中驗證 — 缺關鍵值即 fail-fast（取代舊系統 JWT_SECRET 預設 'dev-secret' 的隱患）。
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 必填'),
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

export const env = parsed.data;
export type Env = typeof env;
