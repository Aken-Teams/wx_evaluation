import { SuzhouSupplierData } from '../types/osat';
import { PurchaseReportData } from '../types';

export const calculateSuzhouQualityReport = (data: SuzhouSupplierData) => {
  const receivedBatches = data.receivedBatches;
  const returnedBatches = data.returnedBatches;
  
  if (receivedBatches === 0) {
    return {
      ...data,
      incomingAcceptanceScoreA1: null,
      incomingAcceptanceScoreA: null,
      baseScoreB1: null,
      baseScoreB2: null,
      totalBaseScoreB: null,
      qualityAssessmentScore: null,
    };
  }
  
  // 進料允收率品質評分(A1) = (進料批數-進料退貨批數)/進料批數，以百分比形式顯示
  const incomingAcceptanceScoreA1 = receivedBatches > 0 ? 
    Math.round(((receivedBatches - returnedBatches) / receivedBatches) * 10000) / 100 : null;
  
  // 進料允收率品質評分(總分A)40% = 進料允收率品質評分(A1) * 40%
  const incomingAcceptanceScoreA = incomingAcceptanceScoreA1 !== null ? 
    Math.round((incomingAcceptanceScoreA1 * 0.4) * 100) / 100 : null;
  
  // 基礎評分(B1)40% = 40 - 5*嚴重客訴(CCR件數) - 1*一般客訴(CCR件數) - 3*客訴再發(CCR件數) - 3*集團CAR(CAR件數)
  const baseScoreB1 = Math.max(0, 40 - (5 * data.severeComplaintCCR) - (1 * data.generalComplaintCCR) - (3 * data.complaintRecurrenceCCR) - (3 * data.groupCAR));
  
  // 基礎評分(B2)10% = 10 - 5*未準時回覆件數(CCR)，最小值為0
  const baseScoreB2 = Math.max(0, 10 - (5 * data.untimelyResponseCCR));
  
  // 基礎評分(總分B)50% = 基礎評分(B1)40% + 基礎評分(B2)10%
  const totalBaseScoreB = Math.round((baseScoreB1 + baseScoreB2) * 100) / 100;
  
  // 品質-品管鑑定分數 = 進料允收率品質評分(總分A)40% + 基礎評分(總分B)50% + 其他10%
  const qualityAssessmentScore = incomingAcceptanceScoreA !== null ? 
    Math.round((incomingAcceptanceScoreA + totalBaseScoreB + (data.others || 0)) * 100) / 100 : null;
  
  // 品質-品管鑑定分數(權重70%) = 品質-品管鑑定分數 × 70%
  const qualityAssessmentScoreWeighted = qualityAssessmentScore !== null ? 
    Math.round((qualityAssessmentScore * 0.7) * 100) / 100 : null;
  
  return {
    ...data,
    incomingAcceptanceScoreA1,
    incomingAcceptanceScoreA,
    baseScoreB1,
    baseScoreB2,
    totalBaseScoreB,
    qualityAssessmentScore,
    qualityAssessmentScoreWeighted,
  };
};

export const calculateSuzhouPurchaseReport = (data: PurchaseReportData) => {
  const receivedBatches = data.receivedBatches;
  
  if (receivedBatches === 0) {
    return {
      ...data,
      purchaseAssessmentScoreA: null,
      totalPurchaseAssessmentScoreA: null,
    };
  }
  
  // OSAT-採購鑑定總分 = 100 - 5*遲交 - 5*特採 - 100*造成斷線 - 25*產生超額運費，最小值為0
  const purchaseAssessmentScoreA = Math.max(0, 100 - (5 * data.lateDelivery) - (5 * data.specialApproval) - (100 * data.productionLineStop) - (25 * data.excessFreight));
  
  // OSAT-採購鑑定分數(權重20%) = OSAT-採購鑑定總分 * 20%
  const totalPurchaseAssessmentScoreA = Math.round((purchaseAssessmentScoreA * 0.2) * 100) / 100;
  
  return {
    ...data,
    purchaseAssessmentScoreA,
    totalPurchaseAssessmentScoreA,
  };
};
