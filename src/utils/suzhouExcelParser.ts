import * as XLSX from 'xlsx';
import { SuzhouSupplierData } from '../types/osat';
import { PurchaseReportData } from '../types';
import { roundTo3Decimals } from './numberUtils';

export const parseSuzhouExcelFile = async (file: File): Promise<{
  suzhouSupplierData: SuzhouSupplierData[];
  suzhouPurchaseReportData: PurchaseReportData[];
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        console.log('Excel檔案工作表列表:', workbook.SheetNames);
        
        // 自動識別包含「品質評鑑報告」和「採購評鑑報告」的工作表
        let qualitySheetName = workbook.SheetNames.find(name => 
          name.includes('品質評鑑報告')
        );
        let purchaseSheetName = workbook.SheetNames.find(name => 
          name.includes('採購評鑑報告')
        );
        
        // 如果找不到特定名稱的工作表，嘗試使用第一個工作表
        if (!qualitySheetName) {
          console.log('未找到「品質評鑑報告」工作表，嘗試使用第一個工作表');
          qualitySheetName = workbook.SheetNames[0];
        }
        
        if (!purchaseSheetName) {
          console.log('未找到「採購評鑑報告」工作表，嘗試使用第一個工作表');
          purchaseSheetName = workbook.SheetNames[0];
        }
        
        if (!qualitySheetName || !purchaseSheetName) {
          reject(new Error('Excel檔案中沒有可用的工作表'));
          return;
        }
        
        console.log('找到工作表:', { qualitySheetName, purchaseSheetName });
        
        // 解析品質評鑑報告
        const qualityWorksheet = workbook.Sheets[qualitySheetName];
        const qualityJsonData = XLSX.utils.sheet_to_json(qualityWorksheet, { header: 1 });
        
        // 解析採購評鑑報告
        const purchaseWorksheet = workbook.Sheets[purchaseSheetName];
        const purchaseJsonData = XLSX.utils.sheet_to_json(purchaseWorksheet, { header: 1 });
        
        console.log('品質評鑑報告數據行數:', qualityJsonData.length);
        console.log('採購評鑑報告數據行數:', purchaseJsonData.length);
        console.log('品質評鑑報告前5行:', qualityJsonData.slice(0, 5));
        console.log('採購評鑑報告前5行:', purchaseJsonData.slice(0, 5));
        console.log('品質評鑑報告所有行:', qualityJsonData);
        console.log('採購評鑑報告所有行:', purchaseJsonData);
        
        // 動態尋找數據開始行
        let dataStartRow = 0;
        
        // 尋找包含「廠商名稱」或「序號」的行作為標題行
        console.log('🔍 開始尋找標題行...');
        for (let i = 0; i < Math.min(10, qualityJsonData.length); i++) {
          const row = qualityJsonData[i] as any[];
          console.log(`檢查第${i+1}行:`, row);
          if (row && row.length > 0) {
            const rowText = row.join('').toLowerCase();
            console.log(`第${i+1}行文本內容:`, rowText);
            if (rowText.includes('廠商') || rowText.includes('序號') || rowText.includes('供應商')) {
              dataStartRow = i + 1; // 數據從標題行的下一行開始
              console.log(`✅ 找到標題行在第${i+1}行，數據從第${dataStartRow+1}行開始`);
              break;
            }
          }
        }
        
        if (dataStartRow === 0) {
          console.log('⚠️ 未找到標題行，使用預設值從第1行開始');
          dataStartRow = 0;
        }
        
        if (dataStartRow >= qualityJsonData.length || dataStartRow >= purchaseJsonData.length) {
          reject(new Error(`Excel檔案格式不正確，無法找到數據行。品質報告行數: ${qualityJsonData.length}, 採購報告行數: ${purchaseJsonData.length}`));
          return;
        }
        
        // 創建廠商數據映射
        const vendorDataMap = new Map<string, SuzhouSupplierData>();
        const purchaseDataMap = new Map<string, PurchaseReportData>();
        
        // 解析品質評鑑報告數據
        let qualityDataCount = 0;
        for (let i = dataStartRow; i < qualityJsonData.length; i++) {
          const row = qualityJsonData[i] as any[];
          console.log(`品質報告第${i+1}行:`, row);
          
          // 檢查行是否有效
          if (row && row.length >= 18) {
            console.log(`行${i+1}長度: ${row.length}, 序號欄位: ${row[0]} (類型: ${typeof row[0]})`);
            
            // 根據實際Excel結構，正確的欄位映射：
            // row[0] = 序號, row[1] = 廠商名稱, row[2] = 出货量
            const vendorName = String(row[1] || '').trim();
            const sequenceNumber = row[0];
            
            console.log(`🔍 檢查第${i+1}行 - 廠商名稱: "${vendorName}", 序號: ${sequenceNumber}, 類型: ${typeof sequenceNumber}`);
            
            if (vendorName && vendorName !== '廠商名稱' && vendorName !== '合計' && vendorName !== '供應商' && vendorName.length > 0) {
              console.log(`✅ 找到有效廠商: ${vendorName}, 序號: ${sequenceNumber}`);
              
              // 放寬序號檢查，只要廠商名稱有效就繼續
              qualityDataCount++;
              vendorDataMap.set(vendorName, {
                vendorName,
                shipmentQuantity: roundTo3Decimals(Number(row[2]) || 0),                    // 出货量（K）- C欄
                receivedBatches: roundTo3Decimals(Number(row[3]) || 0),                     // 進料批數 - D欄
                returnedBatches: roundTo3Decimals(Number(row[4]) || 0),                     // 进料退貨批數 - E欄
                totalComplaintCCR: roundTo3Decimals(Number(row[5]) || 0),                   // 客訴總件數(CCR件數) - F欄
                severeComplaintCCR: roundTo3Decimals(Number(row[6]) || 0),                  // 嚴重客訴(CCR件數) - G欄
                generalComplaintCCR: roundTo3Decimals(Number(row[7]) || 0),                 // 一般客訴(CCR件數) - H欄
                complaintRecurrenceCCR: roundTo3Decimals(Number(row[8]) || 0),              // 客訴再發(CCR件數) - I欄
                groupCAR: roundTo3Decimals(Number(row[9]) || 0),                           // 集团CAR(CAR件數) - J欄
                timelyResponseCCR: roundTo3Decimals(Number(row[10]) || 0),                  // 準時回覆件數(CCR) - K欄
                untimelyResponseCCR: roundTo3Decimals(Number(row[11]) || 0),                // 未準時回覆件數(CCR) - L欄
                // 品質評鑑計算欄位 - 這些欄位由系統計算，不從Excel讀取
                incomingAcceptanceScoreA1: null,                          // 進料允收率品質評分(A1) - 由系統計算
                incomingAcceptanceScoreA: null,                           // 進料允收率品質評分(總分A)40% - 由系統計算
                baseScoreB1: null,                                        // 基數評分(B1)40% - 由系統計算
                baseScoreB2: null,                                        // 基數評分(B2)10% - 由系統計算
                totalBaseScoreB: null,                                    // 基數評分(總分B)50% - 由系統計算
                others: roundTo3Decimals(Number(row[17]) || 0),                          // 其他10% - R欄
                qualityAssessmentScore: null,                             // 品質-品管鑑定分數 - 由系統計算
                qualityAssessmentScoreWeighted: null,                     // 品質-品管鑑定分數(權重70%) - 由系統計算
                serviceQuality: roundTo3Decimals(Number(row[20]) || 0),                  // 服務-品管鑑定分數(權重5%) - U欄
                // 採購評鑑欄位（先設為預設值）
                lateDelivery: 0,
                specialApproval: 0,
                productionLineStop: 0,
                excessFreight: 0,
                purchaseAssessmentScoreA: null,
                servicePurchase: null,
                remarks: String(row[21] || '').trim() || null,            // 備註 - V欄
              });
            } else {
              console.log(`行${i+1}廠商名稱無效: "${vendorName}"`);
            }
          } else {
            console.log(`行${i+1}長度不足或為空: ${row ? row.length : 'null'}`);
          }
        }
        
        // 解析採購評鑑報告數據
        let purchaseDataCount = 0;
        for (let i = dataStartRow; i < purchaseJsonData.length; i++) {
          const row = purchaseJsonData[i] as any[];
          console.log(`採購報告第${i+1}行:`, row);
          
          // 檢查行是否有效 - 採購報告只需要10列
          if (row && row.length >= 10) {
            console.log(`採購行${i+1}長度: ${row.length}, 序號欄位: ${row[0]} (類型: ${typeof row[0]})`);
            
            // 根據實際Excel結構，正確的欄位映射：
            // row[0] = 序號, row[1] = 廠商名稱, row[2] = 進料批數
            const vendorName = String(row[1] || '').trim();
            const sequenceNumber = row[0];
            
            if (vendorName && vendorName !== '廠商名稱' && vendorName !== '合計' && vendorName !== '供應商' && vendorName.length > 0) {
              console.log(`找到採購廠商: ${vendorName}, 序號: ${sequenceNumber}`);
              
              // 放寬序號檢查，只要廠商名稱有效就繼續
              purchaseDataCount++;
              // 創建採購評鑑報告數據
              purchaseDataMap.set(vendorName, {
                vendorName,
                receivedBatches: Number(row[2]) || 0,                     // 進料批數 - C欄
                lateDelivery: Number(row[3]) || 0,                        // 遲交(扣5分) - D欄
                specialApproval: Number(row[4]) || 0,                     // 特採(扣5分) - E欄
                productionLineStop: Number(row[5]) || 0,                  // 造成斷線(扣100分) - F欄
                excessFreight: Number(row[6]) || 0,                       // 產生超額運費(扣25分) - G欄
                purchaseAssessmentScoreA: Number(row[7]) || null,         // OSAT-採購鑑定總分 - H欄
                totalPurchaseAssessmentScoreA: null,                      // OSAT-採購鑑定分數(權重20%) - 這個欄位在Excel中是空的
                service: Number(row[9]) || 0,                            // 服務-採購鑑定分數(權重5%) - J欄
                assessmentScore: null,                                    // 考核得分（暫時設為null）
              });
              
              // 同時更新品質數據中的採購欄位
              const existingQualityData = vendorDataMap.get(vendorName);
              if (existingQualityData) {
                existingQualityData.lateDelivery = Number(row[3]) || 0;
                existingQualityData.specialApproval = Number(row[4]) || 0;
                existingQualityData.productionLineStop = Number(row[5]) || 0;
                existingQualityData.excessFreight = Number(row[6]) || 0;
                existingQualityData.purchaseAssessmentScoreA = Number(row[7]) || null;
                existingQualityData.servicePurchase = Number(row[9]) || null;
              }
            } else {
              console.log(`採購行${i+1}廠商名稱無效: "${vendorName}"`);
            }
          } else {
            console.log(`採購行${i+1}長度不足或為空: ${row ? row.length : 'null'}`);
          }
        }
        
        console.log('解析統計:', { qualityDataCount, purchaseDataCount });
        
        // 轉換為陣列
        const suzhouSupplierData = Array.from(vendorDataMap.values());
        const suzhouPurchaseReportData = Array.from(purchaseDataMap.values());
        
        if (suzhouSupplierData.length === 0) {
          reject(new Error(`未能解析到任何供應商資料。品質數據: ${qualityDataCount}筆, 採購數據: ${purchaseDataCount}筆。請確認檔案格式與數據行結構。`));
          return;
        }
        
        console.log('解析完成:', { 
          qualityCount: suzhouSupplierData.length, 
          purchaseCount: suzhouPurchaseReportData.length 
        });
        
        resolve({
          suzhouSupplierData,
          suzhouPurchaseReportData
        });
      } catch (error) {
        console.error('解析錯誤:', error);
        reject(new Error(`解析 Excel 檔案時發生錯誤: ${error}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('讀取檔案時發生錯誤'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};