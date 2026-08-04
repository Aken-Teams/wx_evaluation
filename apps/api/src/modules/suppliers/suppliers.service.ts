import { Prisma } from '@prisma/client';
import { evaluateAnnual, evaluateQuarter, isAUVendor, type QuarterlyInput } from '@wx/scoring';
import { prisma } from '../../db/prisma';
import { badRequest, notFound } from '../../lib/httpError';
import * as analytics from '../analytics/analytics.service';
import type { Quarter } from '../evaluations/evaluations.service';
import { getConfig } from '../scoring-config/scoring-config.service';

const publicFields = {
  id: true,
  name: true,
  supplierCode: true,
  materialCategory: true,
  region: true,
  isAU: true,
  vendorType: true,
} as const;

export interface SupplierInput {
  name: string;
  supplierCode?: string | null;
  materialCategory?: string | null;
  region?: string | null;
  isAU?: string | null;
  vendorType?: string;
}

export const listSuppliers = () =>
  prisma.sQMVQMVendor.findMany({ orderBy: { name: 'asc' }, select: publicFields });

export const getSupplier = async (id: number) => {
  const vendor = await prisma.sQMVQMVendor.findUnique({ where: { id }, select: publicFields });
  if (!vendor) throw notFound('找不到该供应商');
  return vendor;
};

export const createSupplier = async (data: SupplierInput) => {
  try {
    return await prisma.sQMVQMVendor.create({
      data: { ...data, vendorType: data.vendorType ?? 'domestic' },
      select: publicFields,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      throw badRequest('供应商名称已存在');
    throw e;
  }
};

export const updateSupplier = async (id: number, data: SupplierInput) => {
  await getSupplier(id);
  try {
    return await prisma.sQMVQMVendor.update({ where: { id }, data, select: publicFields });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      throw badRequest('供应商名称已存在');
    throw e;
  }
};

export const deleteSupplier = async (id: number) => {
  await getSupplier(id);
  const reports = await prisma.sQMVQMMonthlyReport.count({ where: { vendorId: id } });
  if (reports > 0) throw badRequest(`该供应商已有 ${reports} 笔评比记录，无法删除`);
  await prisma.sQMVQMVendor.delete({ where: { id } });
  return { ok: true };
};

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

const toScoringInput = (
  r: {
    receivedBatches: number;
    returnedBatches: number;
    externalCAR: number;
    arr: number;
    untimelyResponseCCR: number;
    serviceQuality: number;
    servicePurchase: number;
    deliveryRate: number | null;
    specialApproval: number;
    productionLineStop: number;
  },
  isAU: boolean,
): QuarterlyInput => ({
  receivedBatches: r.receivedBatches ?? 0,
  returnedBatches: r.returnedBatches ?? 0,
  externalCAR: r.externalCAR ?? 0,
  arr: r.arr ?? 0,
  untimelyResponseCCR: r.untimelyResponseCCR ?? 0,
  serviceQuality: r.serviceQuality ?? 0,
  servicePurchase: r.servicePurchase ?? 0,
  deliveryRate: r.deliveryRate ?? null,
  specialApproval: r.specialApproval ?? 0,
  productionLineStop: r.productionLineStop ?? 0,
  isAU,
});

/** 供應商檔案（360）：把一家供應商的評比歷史、年度、背調、比價、排名彙整在一起。 */
export const getProfile = async (id: number) => {
  const vendor = await prisma.sQMVQMVendor.findUnique({ where: { id } });
  if (!vendor) throw notFound('找不到该供应商');
  const isAU = isAUVendor(vendor.isAU);

  const [reports, annualInputs, backgroundChecks, allQuotes, cfg] = await Promise.all([
    prisma.sQMVQMMonthlyReport.findMany({ where: { vendorId: id }, orderBy: [{ year: 'asc' }, { quarter: 'asc' }] }),
    prisma.sQMVQMAnnualInput.findMany({ where: { vendorId: id }, orderBy: { year: 'asc' } }),
    prisma.backgroundCheck.findMany({ where: { vendorId: id }, orderBy: { year: 'desc' } }),
    prisma.sourcingQuote.findMany({ include: { event: true } }),
    getConfig(),
  ]);

  // 季度評比歷史（含原始填報數據，供歷年明細唯讀檢視）
  const quarterlyHistory = reports.map((r) => {
    const s = evaluateQuarter(toScoringInput(r, isAU), cfg);
    return {
      year: r.year,
      quarter: r.quarter,
      period: `${r.year} ${r.quarter}`,
      assessmentScore: s.assessmentScore,
      grade: s.finalGrade,
      quality: s.quality?.qualityScore ?? null,
      purchase: s.purchase?.purchaseScore ?? null,
      service: s.serviceScore,
      noTransaction: s.noTransaction,
      raw: {
        receivedBatches: r.receivedBatches,
        returnedBatches: r.returnedBatches,
        externalCAR: r.externalCAR,
        arr: r.arr,
        untimelyResponseCCR: r.untimelyResponseCCR,
        deliveryRate: r.deliveryRate,
        productionLineStop: r.productionLineStop,
        specialApproval: r.specialApproval,
        serviceQuality: r.serviceQuality,
        servicePurchase: r.servicePurchase,
      },
    };
  });

  // 年度評鑑歷史
  const years = [...new Set(reports.map((r) => r.year))].sort((a, b) => a - b);
  const annualByYear = new Map(annualInputs.map((a) => [a.year, a]));
  const annualHistory = years.map((y) => {
    const quarterScores = QUARTERS.map(
      (q) => quarterlyHistory.find((h) => h.year === y && h.quarter === q)?.assessmentScore ?? null,
    );
    const res = evaluateAnnual(quarterScores, annualByYear.get(y) ?? null);
    return { year: y, ...res };
  });

  // 當前排名（取最新期別，在該期所有供應商中的位置）
  let current: { period: string; score: number | null; grade: string | null; rank: number | null; totalRanked: number } | null =
    null;
  if (reports.length) {
    const latest = reports[reports.length - 1]!;
    const summary = await analytics.getSummary(latest.year, latest.quarter as Quarter);
    const found = summary.ranking.find((r) => r.vendorId === id);
    current = {
      period: `${latest.year} ${latest.quarter}`,
      score: found?.score ?? null,
      grade: found?.grade ?? null,
      rank: found?.rank ?? null,
      totalRanked: summary.ranking.length,
    };
  }

  // 參與過的比價（以名稱模糊比對）
  const sourcingParticipation = allQuotes
    .filter((q) => q.supplierName.includes(vendor.name) || vendor.name.includes(q.supplierName))
    .map((q) => ({ eventId: q.eventId, eventTitle: q.event.title, stage: q.stage, isBest: q.isBest }));

  return {
    vendor: {
      id: vendor.id,
      name: vendor.name,
      supplierCode: vendor.supplierCode,
      materialCategory: vendor.materialCategory,
      region: vendor.region,
      isAU: vendor.isAU,
      vendorType: vendor.vendorType,
    },
    isAU,
    current,
    quarterlyHistory,
    annualHistory,
    backgroundChecks,
    sourcingParticipation,
  };
};

/** 批量匯入：以名稱為鍵 upsert，回傳新增/更新筆數 */
export const batchUpsert = async (items: SupplierInput[]) => {
  let created = 0;
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const existing = await tx.sQMVQMVendor.findUnique({ where: { name: item.name } });
      if (existing) {
        await tx.sQMVQMVendor.update({ where: { name: item.name }, data: item });
        updated += 1;
      } else {
        await tx.sQMVQMVendor.create({ data: { ...item, vendorType: item.vendorType ?? 'domestic' } });
        created += 1;
      }
    }
  });
  return { created, updated, total: items.length };
};
