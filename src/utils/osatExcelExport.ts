import * as XLSX from 'xlsx';
import { OSATQualityReportData, OSATComprehensiveReportData } from '../types/osat';
import { PurchaseReportData } from '../types';

export const exportOSATMonthlyToExcel = (
  qualityData: OSATQualityReportData[],
  purchaseData: PurchaseReportData[],
  comprehensiveData: OSATComprehensiveReportData[],
  year: string,
  month: string
) => {
  const workbook = XLSX.utils.book_new();

  // OSAT 品質評鑑報告
  const qualitySheet = qualityData.map((item, index) => ({
    '序號': index + 1,
    '廠商名稱': item.vendorName,
    '出貨量(K)': item.shipmentQuantity,
    '進料批數': item.receivedBatches,
    '進料退貨批數': item.returnedBatches,
    '客訴總件數\n(CCR件數)': item.totalComplaintCCR,
    '嚴重客訴\n(CCR件數)': item.severeComplaintCCR,
    '一般客訴\n(CCR件數)': item.generalComplaintCCR,
    '客訴再發\n(CCR件數)': item.complaintRecurrenceCCR,
    '集團CAR\n(CAR件數)': item.groupCAR,
    '準時回覆件數\nCCR': item.timelyResponseCCR,
    '未準時回覆件數\nCCR': item.untimelyResponseCCR,
    '進料允收率品質評分\n(A1)': item.incomingAcceptanceScoreA1?.toFixed(2) || '',
    '進料允收率品質評分(總分A)\n40%': item.incomingAcceptanceScoreA?.toFixed(2) || '',
    '基礎評分\n(B1)40%': item.baseScoreB1?.toFixed(2) || '',
    '基礎評分\n(B2)10%': item.baseScoreB2?.toFixed(2) || '',
    '基礎評分(總分B)\n50%': item.totalBaseScoreB?.toFixed(2) || '',
    '其他\n10%': item.others,
    '品質-品管鑑定分數': item.qualityAssessmentScore?.toFixed(2) || '',
    '品質-品管鑑定分數\n(權重70%)': item.qualityAssessmentScoreWeighted?.toFixed(2) || '',
    '服務-品管鑑定分數\n(權重5%)': item.service,
    '備註': item.remarks || '',
  }));

  // 採購評鑑報告（OSAT 和 SQM/VQM 共用）
  const purchaseSheet = purchaseData.map((item, index) => ({
    '序號': index + 1,
    '廠商名稱': item.vendorName,
    '進貨批數': item.receivedBatches,
    '遲交': item.lateDelivery,
    '特採': item.specialApproval,
    '造成斷線': item.productionLineStop,
    '產生超額運費': item.excessFreight,
    'OSAT-採購鑑定總分': item.purchaseAssessmentScoreA?.toFixed(2) || '',
    'OSAT-採購鑑定分數(權重20%)': item.totalPurchaseAssessmentScoreA?.toFixed(2) || '',
    '服務-採購鑑定分數(權重5%)': item.service,
  }));

  // OSAT 綜合評鑑表
  const comprehensiveSheet = comprehensiveData.map((item, index) => ({
    '序號': index + 1,
    '廠商名稱': item.vendorName,
    '總品質評分': item.totalQualityScore?.toFixed(2) || '',
    '交期評分': item.deliveryScore?.toFixed(2) || '',
    '服務評分': item.serviceScore?.toFixed(2) || '',
    '考核得分': item.assessmentScore?.toFixed(2) || '',
    '判定降級': item.downgradeDecision || '',
    '等級': item.grade || '',
  }));

  const qualityWorksheet = XLSX.utils.json_to_sheet(qualitySheet);
  const purchaseWorksheet = XLSX.utils.json_to_sheet(purchaseSheet);
  const comprehensiveWorksheet = XLSX.utils.json_to_sheet(comprehensiveSheet);

  // 設定欄位寬度
  const qualityColWidths = [
    { wch: 5 },   // 序號
    { wch: 20 },  // 廠商名稱
    { wch: 12 },  // 出貨量(K)
    { wch: 10 },  // 進料批數
    { wch: 12 },  // 進料退貨批數
    { wch: 15 },  // 客訴總件數(CCR件數)
    { wch: 15 },  // 嚴重客訴(CCR件數)
    { wch: 15 },  // 一般客訴(CCR件數)
    { wch: 15 },  // 客訴再發(CCR件數)
    { wch: 15 },  // 集團CAR(CAR件數)
    { wch: 15 },  // 準時回覆件數CCR
    { wch: 15 },  // 未準時回覆件數CCR
    { wch: 20 },  // 進料允收率品質評分(A1)
    { wch: 25 },  // 進料允收率品質評分(總分A)40%
    { wch: 15 },  // 基礎評分(B1)40%
    { wch: 15 },  // 基礎評分(B2)10%
    { wch: 18 },  // 基礎評分(總分B)50%
    { wch: 8 },   // 其他10%
    { wch: 18 },  // 品質-品管鑑定分數
    { wch: 25 },  // 品質-品管鑑定分數(權重70%)
    { wch: 20 },  // 服務-品管鑑定分數(權重5%)
    { wch: 20 },  // 備註
  ];

  const purchaseColWidths = [
    { wch: 5 },   // 序號
    { wch: 20 },  // 廠商名稱
    { wch: 10 },  // 進貨批數
    { wch: 8 },   // 遲交
    { wch: 8 },   // 特採
    { wch: 10 },  // 造成斷線
    { wch: 12 },  // 產生超額運費
    { wch: 18 },  // OSAT-採購鑑定總分
    { wch: 22 },  // OSAT-採購鑑定分數(權重20%)
    { wch: 22 },  // 服務-採購鑑定分數(權重5%)
  ];

  // 設定綜合評鑑表欄位寬度
  const comprehensiveColWidths = [
    { wch: 5 },   // 序號
    { wch: 20 },  // 廠商名稱
    { wch: 15 },  // 總品質評分
    { wch: 12 },  // 交期評分
    { wch: 12 },  // 服務評分
    { wch: 12 },  // 考核得分
    { wch: 15 },  // 判定降級
    { wch: 10 },  // 等級
  ];

  qualityWorksheet['!cols'] = qualityColWidths;
  purchaseWorksheet['!cols'] = purchaseColWidths;
  comprehensiveWorksheet['!cols'] = comprehensiveColWidths;

  XLSX.utils.book_append_sheet(workbook, qualityWorksheet, 'OSAT品質評鑑報告');
  XLSX.utils.book_append_sheet(workbook, purchaseWorksheet, 'OSAT採購評鑑報告');
  XLSX.utils.book_append_sheet(workbook, comprehensiveWorksheet, 'OSAT綜合評鑑表');

  const fileName = `OSAT_${year}年${month}月_月評核報告.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

