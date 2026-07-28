import * as XLSX from 'xlsx';
import { OSATQualityAnalysisData } from '../types/osat';
import { roundTo3Decimals } from './numberUtils';

export const parseOSATExcelFile = async (file: File): Promise<OSATQualityAnalysisData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 假設第一個工作表包含資料
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 將工作表轉換為 JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // 尋找標題行，確定欄位位置
        let headerRow = 0;
        let supplierCol = -1;
        let lotnoCol = -1;
        let qtyCol = -1;
        
        // 檢查必要欄位：供應商、QTY (Kpcs)（LOTNO 為選填）
        const requiredFields = ['供應商', 'QTY (Kpcs)'];
        const foundFields: string[] = [];
        
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (row && row.length > 0) {
            for (let j = 0; j < row.length; j++) {
              const cellValue = String(row[j] || '').trim();
              
              // 檢查必要欄位 - 精確匹配
              if (cellValue === '供應商') {
                supplierCol = j;
                if (!foundFields.includes('供應商')) foundFields.push('供應商');
              } else if (cellValue === 'LOTNO') {
                lotnoCol = j;
                if (!foundFields.includes('LOTNO')) foundFields.push('LOTNO');
              } else if (cellValue === 'QTY (Kpcs)') {
                qtyCol = j;
                if (!foundFields.includes('QTY (Kpcs)')) foundFields.push('QTY (Kpcs)');
              }
            }
            
            // 如果找到所有必要欄位（供應商和QTY），記錄標題行位置（LOTNO為選填）
            if (supplierCol !== -1 && qtyCol !== -1) {
              headerRow = i;
              break;
            }
          }
        }
        
        // 檢查是否找到所有必要欄位
        const missingFields = requiredFields.filter(field => !foundFields.includes(field));
        if (missingFields.length > 0) {
          // 顯示前幾行的內容以便調試
          console.log('🔍 Excel檔案前5行內容:');
          for (let i = 0; i < Math.min(5, jsonData.length); i++) {
            console.log(`第${i+1}行:`, jsonData[i]);
          }
          
          reject(new Error(`檔案缺少必要欄位：${missingFields.join('、')}。請確認檔案包含以下欄位：供應商、QTY (Kpcs)。\n\n已找到的欄位：${foundFields.join('、')}\n\n請檢查Excel檔案的標題行是否包含這些欄位名稱。\n\n注意：LOTNO 為選填欄位，如果不存在或為空值，每行資料仍會計入進料批數。`));
          return;
        }
        
        // 調試信息：顯示找到的欄位位置
        console.log('🔍 Excel解析調試信息:');
        console.log('📋 標題行位置:', headerRow);
        console.log('📋 欄位位置 - 供應商:', supplierCol, 'LOTNO:', lotnoCol, 'QTY (Kpcs):', qtyCol);
        
        // 顯示標題行內容
        const headerRowData = jsonData[headerRow];
        console.log('📋 標題行內容:');
        headerRowData.forEach((header, index) => {
          const markers = [];
          if (index === supplierCol) markers.push('← 供應商');
          if (index === lotnoCol) markers.push('← LOTNO');
          if (index === qtyCol) markers.push('← QTY (Kpcs)');
          console.log(`第${index + 1}欄: "${header}" ${markers.join(' ')}`);
        });
        
        
        // 統計資料
        const vendorStats = new Map<string, { lotCount: number; totalQty: number }>();
        
        // 從標題行下一行開始解析資料
        for (let i = headerRow + 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          // 確保有足夠的欄位（供應商和QTY是必要的，LOTNO為選填）
          const maxCol = Math.max(supplierCol, qtyCol, lotnoCol !== -1 ? lotnoCol : -1);
          if (row && row.length > maxCol) {
            const vendorName = String(row[supplierCol] || '').trim();
            const lotno = lotnoCol !== -1 ? String(row[lotnoCol] || '').trim() : '';
            const qty = Number(row[qtyCol]) || 0;
            
            // 檢查是否為有效資料行（非標題行且供應商名稱不為空，QTY > 0）
            // LOTNO 為選填，即使為空也計入進料批數（每行資料算一批）
            if (vendorName && vendorName !== '供應商' && qty > 0) {
              
              if (!vendorStats.has(vendorName)) {
                vendorStats.set(vendorName, { lotCount: 0, totalQty: 0 });
              }
              
              const stats = vendorStats.get(vendorName)!;
              stats.lotCount += 1; // 每行有效資料算一批（不依賴LOTNO）
              stats.totalQty += qty; // 統計QTY總和作為出貨量
            }
          }
        }
        
        if (vendorStats.size === 0) {
          reject(new Error('未能解析到任何廠商資料'));
          return;
        }
        
        // 調試信息：顯示解析到的供應商
        console.log('📊 解析到的供應商列表:');
        const supplierList = Array.from(vendorStats.keys()).sort();
        supplierList.forEach((supplier, index) => {
          console.log(`${index + 1}. ${supplier}`);
        });
        
        // 轉換為 OSATQualityAnalysisData 格式
        const parsedData: OSATQualityAnalysisData[] = [];
        vendorStats.forEach((stats, vendorName) => {
          parsedData.push({
            vendorName,
            shipmentQuantity: String(roundTo3Decimals(stats.totalQty)), // 出貨量(K) = QTY總和
            receivedBatches: roundTo3Decimals(stats.lotCount), // 進料批數 = 有效資料行數（每行算一批，LOTNO可為空）
            returnedBatches: 0, // 預設值，需要使用者輸入
            totalComplaintCCR: 0, // 預設值，需要使用者輸入
            severeComplaintCCR: 0, // 預設值，需要使用者輸入
            generalComplaintCCR: 0, // 預設值，需要使用者輸入
            complaintRecurrenceCCR: 0, // 預設值，需要使用者輸入
            groupCAR: 0, // 預設值，需要使用者輸入
            timelyResponseCCR: 0, // 預設值，需要使用者輸入
            untimelyResponseCCR: 0, // 預設值，需要使用者輸入
            others: 0, // 預設值，需要使用者輸入
            service: 0, // 預設值，需要使用者輸入
            lateDelivery: 0, // 預設值，需要使用者輸入
            specialApproval: 0, // 預設值，需要使用者輸入
            productionLineStop: 0, // 預設值，需要使用者輸入
            excessFreight: 0, // 預設值，需要使用者輸入
            remarks: null, // 預設值，需要使用者輸入
          });
        });
        
        resolve(parsedData);
      } catch (error) {
        reject(new Error('解析 Excel 檔案時發生錯誤'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('讀取檔案時發生錯誤'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};
