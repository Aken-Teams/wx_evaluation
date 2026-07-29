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
  const ids = items.map((i) => i.vendorId);
  const existing = await prisma.sQMVQMVendor.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const known = new Set(existing.map((v) => v.id));
  for (const id of ids) if (!known.has(id)) throw notFound(`供應商 id=${id} 不存在`);

  return prisma.$transaction(
    items.map((it) => {
      const data = {
        latePaymentCount: it.latePaymentCount,
        customerComplaintCount: it.customerComplaintCount,
        qualityAbnormal8D: it.qualityAbnormal8D,
        cooperationScore: it.cooperationScore,
        notes: it.notes ?? null,
      };
      return prisma.backgroundCheck.upsert({
        where: { vendorId_year: { vendorId: it.vendorId, year } },
        create: { vendorId: it.vendorId, year, ...data },
        update: data,
      });
    }),
  );
};
