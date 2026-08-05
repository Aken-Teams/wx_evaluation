import { env } from '../../config/env';
import * as analytics from '../analytics/analytics.service';
import type { Quarter } from '../evaluations/evaluations.service';

export const isConfigured = () => !!env.OLLAMA_API_URL;

const SYSTEM_PROMPT =
  '你是「供应商评比系统」的智能助手。请依据下方【当前数据】用简体中文简洁、专业地回答关于供应商评分、排名、等级、风险的问题。' +
  '评分构面：品质(满分70)+交期(满分20)+服务(满分10)=综合(满分100)；等级 A~E（分数越高越好）。' +
  '若数据不足以回答，请诚实说明，不要杜撰。';

/** 取最新期别的摘要，作为 AI 的资料上下文（让回答有依据） */
const buildContext = async (): Promise<string> => {
  try {
    const periods = await analytics.getAvailablePeriods();
    if (!periods.length) return '目前系统内没有任何评比资料。';
    const p = periods[0]!;
    const s = await analytics.getSummary(p.year, p.quarter as Quarter);
    const top = s.ranking
      .slice(0, 10)
      .map((r) => `${r.rank}.${r.vendorName} ${r.score}(${r.grade})`)
      .join('；');
    const risk = s.watchlist.length ? s.watchlist.map((r) => `${r.vendorName}(${r.grade})`).join('；') : '无';
    return (
      `最新期别：${p.year} 年 ${p.quarter}。` +
      `共 ${s.kpis.count} 家供应商，平均综合分 ${s.kpis.avgScore ?? '—'}，` +
      `等级分布 A:${s.kpis.distribution.A} B:${s.kpis.distribution.B} C:${s.kpis.distribution.C} D:${s.kpis.distribution.D} E:${s.kpis.distribution.E}，` +
      `本季降级 ${s.kpis.downgraded} 家。` +
      `综合分排名前十：${top}。风险观察名单：${risk}。`
    );
  } catch {
    return '';
  }
};

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const buildHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  // Cloudflare 会以浏览器指纹(1010)拦截默认 UA（Node/undici、python-urllib 等），需伪装
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  ...(env.OLLAMA_API_KEY ? { Authorization: `Bearer ${env.OLLAMA_API_KEY}` } : {}),
});

/**
 * 调用 OpenAI 相容 chat completions。
 * 针对 thinking 模型（如 gemma4）：max_tokens 需较大，content 可能为空时 fallback 到 reasoning。
 */
const callCompletions = async (messages: ChatMessage[]): Promise<string> => {
  const payload = { model: env.OLLAMA_MODEL || 'llama3.2', stream: false, max_tokens: 1500, messages };
  const resp = await fetch(`${env.OLLAMA_API_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string; reasoning?: string } }>;
    message?: { content?: string; reasoning?: string };
  };
  const m = data.choices?.[0]?.message ?? data.message;
  return (m?.content || m?.reasoning || '').trim();
};

/** 通用完成：給定 system + user 提示，回傳 AI 回覆（未設定則 configured=false）。 */
export const complete = async (system: string, user: string): Promise<{ configured: boolean; reply: string }> => {
  if (!isConfigured()) return { configured: false, reply: '' };
  try {
    const reply = await callCompletions([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
    return { configured: true, reply: reply || '（AI 无回应内容）' };
  } catch (e) {
    return { configured: true, reply: `AI 服务暂时无法连接：${e instanceof Error ? e.message : '未知错误'}` };
  }
};

export const chat = async (messages: ChatMessage[]): Promise<{ configured: boolean; reply: string }> => {
  if (!isConfigured()) {
    return {
      configured: false,
      reply: 'AI 服务尚未配置。请在后端 apps/api/.env 设定 OLLAMA_API_URL / OLLAMA_API_KEY / OLLAMA_MODEL 后重启服务。',
    };
  }

  const context = await buildContext();
  try {
    const reply = await callCompletions([
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n【当前数据】${context}` },
      ...messages,
    ]);
    return { configured: true, reply: reply || '（AI 无回应内容）' };
  } catch (e) {
    return { configured: true, reply: `AI 服务暂时无法连接：${e instanceof Error ? e.message : '未知错误'}` };
  }
};
