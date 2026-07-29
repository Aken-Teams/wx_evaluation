import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig, type ScoringConfig } from '@wx/scoring';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../../data');
const CONFIG_PATH = path.join(DATA_DIR, 'scoring-config.json');

let cache: ScoringConfig | null = null;

/** 讀取目前評分設定（無檔案時回傳預設 = 現行常數） */
export const getConfig = async (): Promise<ScoringConfig> => {
  if (cache) return cache;
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    cache = JSON.parse(raw) as ScoringConfig;
  } catch {
    cache = defaultConfig;
  }
  return cache;
};

/** 儲存評分設定 */
export const saveConfig = async (cfg: ScoringConfig): Promise<ScoringConfig> => {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
  cache = cfg;
  return cfg;
};

/** 還原為預設 */
export const resetConfig = async (): Promise<ScoringConfig> => saveConfig(defaultConfig);

export { defaultConfig };
