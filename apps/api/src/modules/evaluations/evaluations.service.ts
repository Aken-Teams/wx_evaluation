import { evaluateQuarter, isAUVendor } from '@wx/scoring';
import type { QuarterlyInput } from '@wx/scoring';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { notFound } from '../../lib/httpError';
import { getConfig } from '../scoring-config/scoring-config.service';

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

/** DB 原始欄位（或使用者輸入）→ 評分引擎輸入 */
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

/** 取得某年某季所有供應商的評比（分數即時由引擎計算，非讀舊存值） */
export const getQuarterly = async (year: number, quarter: Quarter) => {
  const [reports, cfg] = await Promise.all([
    prisma.sQMVQMMonthlyReport.findMany({
      where: { year, quarter },
      include: { vendor: true },
      orderBy: { vendor: { name: 'asc' } },
    }),
    getConfig(),
  ]);

  return reports.map((r) => {
    const isAU = isAUVendor(r.vendor.isAU);
    const score = evaluateQuarter(toScoringInput(r, isAU), cfg);
    return {
      vendorId: r.vendorId,
      vendorName: r.vendor.name,
      isAU,
      raw: {
        receivedBatches: r.receivedBatches,
        returnedBatches: r.returnedBatches,
        externalCAR: r.externalCAR,
        arr: r.arr,
        untimelyResponseCCR: r.untimelyResponseCCR,
        serviceQuality: r.serviceQuality,
        servicePurchase: r.servicePurchase,
        deliveryRate: r.deliveryRate,
        specialApproval: r.specialApproval,
        productionLineStop: r.productionLineStop,
        remarks: r.remarks,
      },
      score,
    };
  });
};

export interface EvaluationItemInput {
  vendorId: number;
  receivedQuantity: string;
  returnedQuantity: string;
  receivedBatches: number;
  returnedBatches: number;
  arr: number;
  lrr: number;
  externalCAR: number;
  untimelyResponseCCR: number;
  others: number;
  serviceQuality: number;
  lateDelivery: number;
  deliveryRate: number | null;
  specialApproval: number;
  productionLineStop: number;
  excessFreight: number;
  servicePurchase: number;
  remarks?: string | null;
}

/**
 * 儲存某年某季的評比（整批）。
 * - 分數一律由引擎重算（不信任前端傳來的分數）
 * - 全批包在單一交易中：任一筆失敗則整批回滾（取代舊系統無交易、迴圈 upsert 的隱患）
 */
export const saveQuarterly = async (year: number, quarter: Quarter, items: EvaluationItemInput[]) => {
  // 先驗證所有 vendorId 皆存在（交易外先讀，減少交易時間）
  const vendorIds = items.map((i) => i.vendorId);
  const [vendors, cfg] = await Promise.all([
    prisma.sQMVQMVendor.findMany({ where: { id: { in: vendorIds } } }),
    getConfig(),
  ]);
  const vendorMap = new Map(vendors.map((v) => [v.id, v]));
  for (const id of vendorIds) {
    if (!vendorMap.has(id)) throw notFound(`供應商 id=${id} 不存在`);
  }

  // 單條批量 upsert（1 次 DB 來回）——分數仍由引擎重算，取代逐筆 upsert，避免經跳板 N 次來回逾時。
  const rows = items.map((item) => {
    const vendor = vendorMap.get(item.vendorId)!;
    const isAU = isAUVendor(vendor.isAU);
    const score = evaluateQuarter(toScoringInput(item, isAU), cfg);
    return Prisma.sql`(${year}, ${quarter}, ${item.vendorId}, ${item.receivedQuantity}, ${item.returnedQuantity}, ${item.receivedBatches}, ${item.returnedBatches}, ${item.arr}, ${item.lrr}, ${item.externalCAR}, ${item.untimelyResponseCCR}, ${item.others}, ${item.serviceQuality}, ${item.lateDelivery}, ${item.deliveryRate}, ${item.specialApproval}, ${item.productionLineStop}, ${item.excessFreight}, ${item.servicePurchase}, ${item.remarks ?? null}, ${score.quality?.carScore ?? null}, ${score.quality?.qualityScore ?? null}, ${score.purchase?.purchaseScore ?? null}, ${score.assessmentScore}, NOW(3), NOW(3))`;
  });

  await prisma.$executeRaw`
    INSERT INTO va_SQMVQMMonthlyReport
      (year, quarter, vendorId, receivedQuantity, returnedQuantity, receivedBatches, returnedBatches, arr, lrr, externalCAR, untimelyResponseCCR, others, serviceQuality, lateDelivery, deliveryRate, specialApproval, productionLineStop, excessFreight, servicePurchase, remarks, totalBaseScoreB, qualityAssessmentScoreC1, totalPurchaseAssessmentScoreA, assessmentScore, createdAt, updatedAt)
    VALUES ${Prisma.join(rows)}
    ON DUPLICATE KEY UPDATE
      receivedQuantity = VALUES(receivedQuantity), returnedQuantity = VALUES(returnedQuantity),
      receivedBatches = VALUES(receivedBatches), returnedBatches = VALUES(returnedBatches),
      arr = VALUES(arr), lrr = VALUES(lrr), externalCAR = VALUES(externalCAR),
      untimelyResponseCCR = VALUES(untimelyResponseCCR), others = VALUES(others),
      serviceQuality = VALUES(serviceQuality), lateDelivery = VALUES(lateDelivery),
      deliveryRate = VALUES(deliveryRate), specialApproval = VALUES(specialApproval),
      productionLineStop = VALUES(productionLineStop), excessFreight = VALUES(excessFreight),
      servicePurchase = VALUES(servicePurchase), remarks = VALUES(remarks),
      totalBaseScoreB = VALUES(totalBaseScoreB), qualityAssessmentScoreC1 = VALUES(qualityAssessmentScoreC1),
      totalPurchaseAssessmentScoreA = VALUES(totalPurchaseAssessmentScoreA), assessmentScore = VALUES(assessmentScore),
      updatedAt = NOW(3)
  `;
  return { count: items.length };
};
