import { evaluateAnnual } from '@wx/scoring';
import { prisma } from '../../db/prisma';
import { notFound } from '../../lib/httpError';

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

/** 供應商地區歸一化（僅需辨別「国外」以決定預設稽核類型） */
const supplierType = (v: { region: string | null; vendorType: string }): string => {
  const s = `${v.region ?? ''}${v.vendorType ?? ''}`;
  if (s.includes('国外')) return '国外';
  if (s.includes('海外')) return '海外';
  return '国内';
};

export const getAnnual = async (year: number) => {
  const [vendors, reports, inputs] = await Promise.all([
    prisma.sQMVQMVendor.findMany({ orderBy: { name: 'asc' } }),
    prisma.sQMVQMMonthlyReport.findMany({ where: { year } }),
    prisma.sQMVQMAnnualInput.findMany({ where: { year } }),
  ]);

  const reportsByVendor = new Map<number, typeof reports>();
  for (const r of reports) {
    const list = reportsByVendor.get(r.vendorId) ?? [];
    list.push(r);
    reportsByVendor.set(r.vendorId, list);
  }
  const inputByVendor = new Map(inputs.map((i) => [i.vendorId, i]));

  return vendors.map((v) => {
    const vReports = reportsByVendor.get(v.id) ?? [];
    const quarterScores: Record<Quarter, number | null> = { Q1: null, Q2: null, Q3: null, Q4: null };
    let tradingQuarters = 0;
    let totalReceivedBatches = 0;
    for (const r of vReports) {
      if (QUARTERS.includes(r.quarter as Quarter)) quarterScores[r.quarter as Quarter] = r.assessmentScore;
      if (r.receivedBatches > 0) tradingQuarters += 1;
      totalReceivedBatches += r.receivedBatches ?? 0;
    }

    const input = inputByVendor.get(v.id) ?? null;
    const result = evaluateAnnual(
      QUARTERS.map((q) => quarterScores[q]),
      input,
    );
    const st = supplierType(v);
    const nextYearAuditType = input?.nextYearAuditType || (st === '国外' ? '文件审核' : '实地稽核');

    return {
      vendorId: v.id,
      vendorName: v.name,
      supplierType: st,
      quarterScores,
      tradingQuarters,
      totalReceivedBatches,
      audit: {
        VDA: input?.VDA ?? null,
        QSA: input?.QSA ?? null,
        QPA: input?.QPA ?? null,
        HSF: input?.HSF ?? null,
        CSR: input?.CSR ?? null,
      },
      others: input?.others ?? null,
      nextYearAuditType,
      remarks: input?.remarks ?? null,
      ...result,
    };
  });
};

export interface AnnualItemInput {
  vendorId: number;
  VDA: number | null;
  QSA: number | null;
  QPA: number | null;
  HSF: number | null;
  CSR: number | null;
  others: number | null;
  nextYearAuditType?: string | null;
  remarks?: string | null;
}

export const saveAnnual = async (year: number, items: AnnualItemInput[]) => {
  const vendorIds = items.map((i) => i.vendorId);
  const existing = await prisma.sQMVQMVendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true } });
  const known = new Set(existing.map((v) => v.id));
  for (const id of vendorIds) if (!known.has(id)) throw notFound(`供應商 id=${id} 不存在`);

  return prisma.$transaction(
    items.map((item) => {
      const data = {
        VDA: item.VDA,
        QSA: item.QSA,
        QPA: item.QPA,
        HSF: item.HSF,
        CSR: item.CSR,
        others: item.others,
        nextYearAuditType: item.nextYearAuditType ?? null,
        remarks: item.remarks ?? null,
      };
      return prisma.sQMVQMAnnualInput.upsert({
        where: { year_vendorId: { year, vendorId: item.vendorId } },
        create: { year, vendorId: item.vendorId, ...data },
        update: data,
      });
    }),
  );
};
