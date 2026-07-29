import { round2 } from '@wx/scoring';
import { prisma } from '../../db/prisma';
import { getQuarterly, type Quarter } from '../evaluations/evaluations.service';

export interface PeriodSummary {
  count: number;
  scored: number;
  avgScore: number | null;
  distribution: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'none', number>;
  downgraded: number;
}

type Evals = Awaited<ReturnType<typeof getQuarterly>>;

const summarize = (evals: Evals): PeriodSummary => {
  const scored = evals.filter((e) => e.score.assessmentScore != null);
  const avgScore = scored.length
    ? round2(scored.reduce((s, e) => s + (e.score.assessmentScore ?? 0), 0) / scored.length)
    : null;
  const distribution = { A: 0, B: 0, C: 0, D: 0, E: 0, none: 0 } as PeriodSummary['distribution'];
  for (const e of evals) {
    const g = e.score.finalGrade;
    if (g) distribution[g] += 1;
    else distribution.none += 1;
  }
  return {
    count: evals.length,
    scored: scored.length,
    avgScore,
    distribution,
    downgraded: evals.filter((e) => e.score.downgraded).length,
  };
};

/** 有資料的年/季（供選單） */
export const getAvailablePeriods = () =>
  prisma.sQMVQMMonthlyReport.findMany({
    distinct: ['year', 'quarter'],
    select: { year: true, quarter: true },
    orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
  });

/** 單期彙整：KPI + 排名 */
export const getSummary = async (year: number, quarter: Quarter) => {
  const evals = await getQuarterly(year, quarter);
  const ranking = evals
    .filter((e) => e.score.assessmentScore != null)
    .sort((a, b) => (b.score.assessmentScore ?? 0) - (a.score.assessmentScore ?? 0))
    .map((e, i) => ({
      rank: i + 1,
      vendorId: e.vendorId,
      vendorName: e.vendorName,
      isAU: e.isAU,
      score: e.score.assessmentScore,
      grade: e.score.finalGrade,
      quality: e.score.quality?.qualityScore ?? null,
      purchase: e.score.purchase?.purchaseScore ?? null,
      service: e.score.serviceScore,
      downgraded: e.score.downgraded,
    }));

  // 風險名單：被降級、或最終等級 C/D
  const watchlist = ranking.filter((r) => r.downgraded || r.grade === 'C' || r.grade === 'D');

  return { period: { year, quarter }, kpis: summarize(evals), ranking, watchlist };
};

/** 年度趨勢：各季平均分與等級分布 */
export const getTrend = async (year: number) => {
  const periods = await prisma.sQMVQMMonthlyReport.findMany({
    where: { year },
    distinct: ['quarter'],
    select: { quarter: true },
    orderBy: { quarter: 'asc' },
  });

  const out = [];
  for (const p of periods) {
    const evals = await getQuarterly(year, p.quarter as Quarter);
    out.push({ quarter: p.quarter, ...summarize(evals) });
  }
  return out;
};
