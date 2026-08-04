import type { Period } from '../types';

export const quarterNum = (q: string): number => Number(q[1]);

/**
 * 判定所选期别是否为「过往（已封存）」：比现有资料中最新的期别更早者视为过往。
 * 全新（未来）期别或最新期别 → 非过往（可编辑）。
 */
export const isPastPeriod = (period: Period | null, periods: Period[] | undefined): boolean => {
  if (!period || !periods?.length) return false;
  const latest = periods.reduce((a, b) =>
    b.year > a.year || (b.year === a.year && quarterNum(b.quarter) > quarterNum(a.quarter)) ? b : a,
  );
  return period.year < latest.year || (period.year === latest.year && quarterNum(period.quarter) < quarterNum(latest.quarter));
};
