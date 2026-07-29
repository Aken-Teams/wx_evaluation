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

export const chat = async (messages: ChatMessage[]): Promise<{ configured: boolean; reply: string }> => {
  if (!isConfigured()) {
    return {
      configured: false,
      reply: 'AI 服务尚未配置。请在后端 apps/api/.env 设定 OLLAMA_API_URL / OLLAMA_API_KEY / OLLAMA_MODEL 后重启服务。',
    };
  }

  const context = await buildContext();
  const payload = {
    model: env.OLLAMA_MODEL || 'llama3.2',
    stream: false,
    max_tokens: 1000,
    messages: [{ role: 'system', content: `${SYSTEM_PROMPT}\n\n【当前数据】${context}` }, ...messages],
  };

  try {
    const resp = await fetch(`${env.OLLAMA_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.OLLAMA_API_KEY ? { Authorization: `Bearer ${env.OLLAMA_API_KEY}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) return { configured: true, reply: `AI 服务返回错误（HTTP ${resp.status}）。` };
    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      message?: { content?: string };
    };
    const reply = data.choices?.[0]?.message?.content || data.message?.content || '（AI 无回应内容）';
    return { configured: true, reply };
  } catch (e) {
    return { configured: true, reply: `AI 服务暂时无法连接：${e instanceof Error ? e.message : '未知错误'}` };
  }
};
