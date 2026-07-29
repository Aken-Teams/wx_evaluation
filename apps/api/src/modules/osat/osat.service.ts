import { prisma } from '../../db/prisma';

/** 有資料的 OSAT 年/月（供選單）。目前 OSAT 表為空，回傳空陣列。 */
export const getPeriods = () =>
  prisma.oSATMonthlyReport.findMany({
    distinct: ['year', 'month'],
    select: { year: true, month: true },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });

/** 讀取某年某月 OSAT 月評核（含供應商）。分數為現有儲存值（OSAT 評分引擎尚未重建）。 */
export const getMonthly = async (year: number, month: number, factory?: string) => {
  const reports = await prisma.oSATMonthlyReport.findMany({
    where: { year, month, ...(factory ? { factory } : {}) },
    include: { vendor: true },
    orderBy: { vendor: { name: 'asc' } },
  });
  return reports.map((r) => ({
    vendorId: r.vendorId,
    vendorName: r.vendor.name,
    factory: r.factory,
    shipmentQuantity: r.shipmentQuantity,
    receivedBatches: r.receivedBatches,
    returnedBatches: r.returnedBatches,
    totalComplaintCCR: r.totalComplaintCCR,
    qualityAssessmentScore: r.qualityAssessmentScore,
    purchaseAssessmentScoreA: r.purchaseAssessmentScoreA,
    assessmentScore: r.assessmentScore,
    remarks: r.remarks,
  }));
};
