import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { notFound } from '../../lib/httpError';

export const getByYear = async (year: number) => {
  const [vendors, checks] = await Promise.all([
    prisma.sQMVQMVendor.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, region: true } }),
    prisma.backgroundCheck.findMany({ where: { year } }),
  ]);
  const byVendor = new Map(checks.map((c) => [c.vendorId, c]));
  return vendors.map((v) => {
    const c = byVendor.get(v.id);
    return {
      vendorId: v.id,
      vendorName: v.name,
      region: v.region,
      latePaymentCount: c?.latePaymentCount ?? 0,
      customerComplaintCount: c?.customerComplaintCount ?? 0,
      qualityAbnormal8D: c?.qualityAbnormal8D ?? 0,
      cooperationScore: c?.cooperationScore ?? null,
      notes: c?.notes ?? null,
    };
  });
};

export interface BackgroundItem {
  vendorId: number;
  latePaymentCount: number;
  customerComplaintCount: number;
  qualityAbnormal8D: number;
  cooperationScore: number | null;
  notes?: string | null;
}

export const saveByYear = async (year: number, items: BackgroundItem[]) => {
  if (items.length === 0) return { count: 0 };
  const ids = items.map((i) => i.vendorId);
  const existing = await prisma.sQMVQMVendor.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const known = new Set(existing.map((v) => v.id));
  for (const id of ids) if (!known.has(id)) throw notFound(`供應商 id=${id} 不存在`);

  // 單條批量 upsert（1 次 DB 來回）——取代逐筆 upsert，避免經跳板時 N 次來回逾時。
  const rows = items.map(
    (it) =>
      Prisma.sql`(${it.vendorId}, ${year}, ${it.latePaymentCount}, ${it.customerComplaintCount}, ${it.qualityAbnormal8D}, ${it.cooperationScore}, ${it.notes ?? null}, NOW(3), NOW(3))`,
  );
  await prisma.$executeRaw`
    INSERT INTO va_BackgroundCheck
      (vendorId, year, latePaymentCount, customerComplaintCount, qualityAbnormal8D, cooperationScore, notes, createdAt, updatedAt)
    VALUES ${Prisma.join(rows)}
    ON DUPLICATE KEY UPDATE
      latePaymentCount = VALUES(latePaymentCount),
      customerComplaintCount = VALUES(customerComplaintCount),
      qualityAbnormal8D = VALUES(qualityAbnormal8D),
      cooperationScore = VALUES(cooperationScore),
      notes = VALUES(notes),
      updatedAt = NOW(3)
  `;
  return { count: items.length };
};
