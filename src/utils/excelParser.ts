﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import * as XLSX from 'xlsx';
import { QualityAnalysisData } from '../types';

export const parseExcelFile = async (file: File): Promise<QualityAnalysisData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        if (!data) {
          reject(new Error('未讀取到檔案內容'));
          return;
        }
        const workbook = XLSX.read(data, { type: 'array' });
        const rawResults: QualityAnalysisData[] = [];
        try { console.log('[excelParser] sheets:', workbook.SheetNames); } catch {}

        const normalize = (s: any) => (s ?? '').toString().toLowerCase().replace(/[\s\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/g, '');
        const toNumber = (s: any) => {
          const str = (s ?? '').toString().replace(/[,\s]/g, '');
          const n = Number(str);
          return Number.isFinite(n) ? n : 0;
        };
        const parseInspectionTime = (timeStr: string): { year: number | null; quarter: string | null } => {
          const match = (timeStr ?? '').toString().trim().match(/^(\d{4})Q([1-4])$/i);
          if (match) {
            return {
              year: parseInt(match[1], 10),
              quarter: `Q${match[2]}`
            };
          }
          return { year: null, quarter: null };
        };

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) continue;
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

          if (jsonData.length < 2) continue;

          const firstRow = (jsonData[0] as any[]) || [];
          const isNewFormat = firstRow.some(cell => {
            const normalized = normalize(cell);
            return normalized.includes('供应商') || normalized.includes('供應商') || normalized.includes('vendor');
          });

          if (isNewFormat) {
            const vendorColIndex = firstRow.findIndex(cell => {
              const normalized = normalize(cell);
              return normalized.includes('供应商') || normalized.includes('供應商') || normalized.includes('vendor');
            });
            const inspectionTimeColIndex = firstRow.findIndex(cell => {
              const normalized = normalize(cell);
              return normalized.includes('检验时间') || normalized.includes('檢驗時間') || normalized.includes('inspection') || normalized.includes('time');
            });
            const receivedBatchesColIndex = firstRow.findIndex(cell => {
              const normalized = normalize(cell);
              return normalized.includes('检验批数') || normalized.includes('檢驗批數') || normalized.includes('received') || normalized.includes('batches');
            });
            const returnedBatchesColIndex = firstRow.findIndex(cell => {
              const normalized = normalize(cell);
              return normalized.includes('退货批数') || normalized.includes('退貨批數') || normalized.includes('returned') || normalized.includes('退货');
            });
            // 迟交批数已不再從上傳 Excel 解析（採購評鑑改用退貨批數）
            const externalCARColIndex = firstRow.findIndex(cell => {
              const normalized = normalize(cell);
              return normalized.includes('外部客诉') || normalized.includes('外部客訴') || normalized.includes('externalCAR') || normalized.includes('external');
            });
            const arrColIndex = firstRow.findIndex(cell => {
              const normalized = normalize(cell);
              return normalized.includes('产线') || normalized.includes('產線') || normalized.includes('car件数') || normalized.includes('car件數') || normalized.includes('arr');
            });
            const untimelyResponseCCRColIndex = firstRow.findIndex(cell => {
              const normalized = normalize(cell);
              return normalized.includes('延迟回复') || normalized.includes('延遲回覆') || normalized.includes('untimely') || normalized.includes('response');
            });

            for (let i = 1; i < jsonData.length; i++) {
              const row = (jsonData[i] as any[]) || [];
              const vendorName = (row[vendorColIndex] ?? '').toString().trim();
              if (!vendorName) continue;

              const vendorNameLower = vendorName.toLowerCase();
              const vendorNameNormalized = vendorName.replace(/[\s\u3000]+/g, '');

              const skipVendors = [
                'ATEC106162',
                '東晶106974',
                'CENTRAL(代工)CT-L',
                '創日-LRO-L'
              ];

              const shouldSkip = skipVendors.some(skipVendor => {
                const skipNormalized = skipVendor.replace(/[\s\u3000]+/g, '').toLowerCase();
                return vendorNameNormalized.toLowerCase() === skipNormalized ||
                       vendorNameNormalized.toLowerCase().includes(skipNormalized);
              });

              if (shouldSkip) continue;

              if (vendorNameLower.includes('-d') || vendorNameLower.includes('-t')) {
                if (!(vendorNameLower.includes('-d') || vendorNameLower.includes('-t'))) {
                  continue;
                }
              } else if (vendorNameLower.includes('-') && !vendorNameLower.includes('免')) {
                continue;
              }

              const receivedBatches = toNumber(row[receivedBatchesColIndex]);
              const returnedBatches = toNumber(row[returnedBatchesColIndex]);
              const lateDelivery = 0; // 不再解析迟交批数
              const externalCAR = externalCARColIndex >= 0 ? toNumber(row[externalCARColIndex]) : 0;
              const arr = arrColIndex >= 0 ? toNumber(row[arrColIndex]) : 0;
              const untimelyResponseCCR = untimelyResponseCCRColIndex >= 0 ? toNumber(row[untimelyResponseCCRColIndex]) : 0;
              const receivedQuantity = '';
              const returnedQuantity = '';

              const inspectionTime = (row[inspectionTimeColIndex] ?? '').toString().trim();
              const parsedTime = parseInspectionTime(inspectionTime);
              
              const entry = {
                vendorName,
                receivedBatches,
                returnedBatches,
                receivedQuantity,
                returnedQuantity,
                arr,
                lrr: 0,
                externalCAR,
                untimelyResponseCCR,
                others: 0,
                service: 0,
                lateDelivery,
                specialApproval: 0,
                productionLineStop: 0,
                excessFreight: 0,
                inspectionTime,
                _parsedYear: parsedTime.year,
                _parsedQuarter: parsedTime.quarter,
              } as QualityAnalysisData & { _parsedYear?: number | null; _parsedQuarter?: string | null };
              try { console.log('[excelParser] new format row', i, 'vendor=', vendorName, 'externalCAR=', externalCAR, 'arr=', arr, 'untimelyResponseCCR=', untimelyResponseCCR); } catch {}
              rawResults.push(entry);
            }
            
            const detectedYear = rawResults[0]?._parsedYear;
            const detectedQuarter = rawResults[0]?._parsedQuarter;
            try { console.log('[excelParser] detectedYear=', detectedYear, 'detectedQuarter=', detectedQuarter); } catch {}
          } else {
            const looksLikeTotal = (s: any) => {
              const n = normalize(s);
              return n.includes('合計') || n.includes('總計') || n.includes('total');
            };

            for (let i = 0; i < jsonData.length; i++) {
              const row = (jsonData[i] as any[]) || [];

              let totalColIndex = -1;
              for (let c = 0; c < Math.max(8, row.length); c++) {
                if (looksLikeTotal(row[c])) { totalColIndex = c; break; }
              }
              if (totalColIndex === -1) continue;

              let vendorName = '';
              let j = i - 1;
              while (j >= 0) {
                const prevRow = (jsonData[j] as any[]) || [];
                const candidateIndices = [totalColIndex + 1, 1];
                let found = '';
                for (const ci of candidateIndices) {
                  const rawCandidate = (prevRow[ci] ?? '').toString();
                  const normalized = rawCandidate.replace(/[\s\u3000]+/g, '');
                  if (normalized && normalized !== '廠商') { found = rawCandidate.trim(); break; }
                }
                if (found) { vendorName = found; break; }
                j--;
              }
              if (!vendorName) continue;

              const vendorNameLower = vendorName.toLowerCase();
              const vendorNameNormalized = vendorName.replace(/[\s\u3000]+/g, '');

              const skipVendors = [
                'ATEC106162',
                '東晶106974',
                'CENTRAL(代工)CT-L',
                '創日-LRO-L'
              ];

              const shouldSkip = skipVendors.some(skipVendor => {
                const skipNormalized = skipVendor.replace(/[\s\u3000]+/g, '').toLowerCase();
                return vendorNameNormalized.toLowerCase() === skipNormalized ||
                       vendorNameNormalized.toLowerCase().includes(skipNormalized);
              });

              if (shouldSkip) continue;

              if (vendorNameLower.includes('-d') || vendorNameLower.includes('-t')) {
                const hasValidSuffix = vendorNameLower.includes('-d') || vendorNameLower.includes('-t');
                if (!hasValidSuffix) {
                  continue;
                }
              } else if (vendorNameLower.includes('免')) {
              } else if (vendorNameLower.includes('-')) {
                continue;
              }

              const receivedBatches = toNumber(row[totalColIndex + 2]);
              const returnedBatches = toNumber(row[totalColIndex + 3]);
              const receivedQuantity = (row[totalColIndex + 4] ?? '').toString();
              const returnedQuantity = (row[totalColIndex + 5] ?? '').toString();

              const entry = {
                vendorName,
                receivedBatches,
                returnedBatches,
                receivedQuantity,
                returnedQuantity,
                arr: 0,
                lrr: 0,
                externalCAR: 0,
                untimelyResponseCCR: 0,
                others: 0,
                service: 0,
                lateDelivery: 0,
                specialApproval: 0,
                productionLineStop: 0,
                excessFreight: 0,
              } as QualityAnalysisData;
              try { console.log('[excelParser] old format row', i, 'vendor=', vendorName, 'recvBatches=', receivedBatches, 'retBatches=', returnedBatches); } catch {}
              rawResults.push(entry);
            }
          }
        }

        // 合併處理邏輯
        const mergedResults: QualityAnalysisData[] = [];
        const processedVendors = new Set<string>();

        // 輔助函數：提取基礎廠商名稱（移除"免"字）
        const removeMianSuffix = (name: string): string => {
          return name.replace(/免/gi, '');
        };

        // 先處理所有廠商（包括主廠商、-D、-T、免）
        for (const entry of rawResults) {
          const vendorName = entry.vendorName;
          const vendorNameLower = vendorName.toLowerCase();
          
          // 如果已經處理過，跳過
          if (processedVendors.has(vendorName)) {
            continue;
          }

          // 檢查是否為-D或-T廠商
          const isD = vendorNameLower.includes('-d');
          const isT = vendorNameLower.includes('-t');
          // 檢查是否包含"免"後綴
          const hasMian = vendorNameLower.includes('免');
          
          if (isD || isT) {
            // 提取基礎廠商名稱（移除後綴）
            let baseVendorName = '';
            if (isD) {
              baseVendorName = vendorName.replace(/-d/gi, '');
            } else if (isT) {
              baseVendorName = vendorName.replace(/-t/gi, '');
            }
            
            // 查找是否有主廠商
            const hasMainVendor = rawResults.some(r => 
              r.vendorName.toLowerCase() === baseVendorName.toLowerCase()
            );
            
            if (!hasMainVendor) {
              // 沒有主廠商，單獨保留這個-D或-T廠商，但使用基礎廠商名稱
              const singleEntry: QualityAnalysisData = {
                ...entry,
                vendorName: baseVendorName, // 使用基礎廠商名稱
              };
              mergedResults.push(singleEntry);
              processedVendors.add(vendorName);
              continue;
            }
          } else if (hasMian) {
            // 處理包含"免"後綴的廠商
            const baseVendorName = removeMianSuffix(vendorName);
            
            // 查找是否有主廠商（不包含"免"的基礎名稱）
            const hasMainVendor = rawResults.some(r => {
              const rName = r.vendorName;
              const rNameLower = rName.toLowerCase();
              // 主廠商不包含"免"、"-d"、"-t"等後綴
              return !rNameLower.includes('免') && 
                     !rNameLower.includes('-d') && 
                     !rNameLower.includes('-t') &&
                     rName.toLowerCase() === baseVendorName.toLowerCase();
            });
            
            if (!hasMainVendor) {
              // 沒有主廠商，使用基礎廠商名稱（移除"免"）
              const singleEntry: QualityAnalysisData = {
                ...entry,
                vendorName: baseVendorName, // 使用基礎廠商名稱（移除"免"）
              };
              mergedResults.push(singleEntry);
              processedVendors.add(vendorName);
              continue;
            }
            // 如果有主廠商，會在下面的主廠商處理邏輯中合併
          }
          
          // 處理主廠商或需要合併的情況
          if (!isD && !isT && !hasMian) {
            // 主廠商，查找相關的-D、-T和"免"後綴廠商
            const baseVendorName = vendorName;
            const relatedVendors = rawResults.filter(r => {
              const rName = r.vendorName;
              const rNameLower = rName.toLowerCase();
              
              // 檢查是否為同一廠商的不同後綴
              if (rNameLower.includes('-d') || rNameLower.includes('-t')) {
                // 有後綴的廠商，提取基礎廠商名稱進行比較
                let rBaseName = '';
                if (rNameLower.includes('-d')) {
                  rBaseName = rName.replace(/-d/gi, '');
                } else if (rNameLower.includes('-t')) {
                  rBaseName = rName.replace(/-t/gi, '');
                }
                return rBaseName.toLowerCase() === baseVendorName.toLowerCase();
              } else if (rNameLower.includes('免')) {
                // 包含"免"後綴的廠商，提取基礎廠商名稱進行比較
                const rBaseName = removeMianSuffix(rName);
                return rBaseName.toLowerCase() === baseVendorName.toLowerCase();
              } else {
                // 沒有後綴的廠商，直接比較
                return rName.toLowerCase() === baseVendorName.toLowerCase();
              }
            });

            if (relatedVendors.length === 1) {
              // 只有主廠商，直接添加
              mergedResults.push(entry);
                         } else {
               // 有相關廠商，需要合併

               // 按順序處理：主廠商、-D、-T、"免"
               const sortedVendors = relatedVendors.sort((a, b) => {
                 const aNameLower = a.vendorName.toLowerCase();
                 const bNameLower = b.vendorName.toLowerCase();
                 
                 // 主廠商（沒有後綴）排在最前面
                 const aHasSuffix = aNameLower.includes('-d') || aNameLower.includes('-t') || aNameLower.includes('免');
                 const bHasSuffix = bNameLower.includes('-d') || bNameLower.includes('-t') || bNameLower.includes('免');
                 
                 if (!aHasSuffix && bHasSuffix) return -1;
                 if (aHasSuffix && !bHasSuffix) return 1;
                 
                 // 都有後綴時，-D排在-T前面，-T排在"免"前面
                 if (aHasSuffix && bHasSuffix) {
                   const aIsD = aNameLower.includes('-d');
                   const bIsD = bNameLower.includes('-d');
                   const aIsT = aNameLower.includes('-t');
                   const bIsT = bNameLower.includes('-t');
                   const aHasMian = aNameLower.includes('免');
                   const bHasMian = bNameLower.includes('免');
                   
                   // -D 優先
                   if (aIsD && !bIsD && !bHasMian) return -1;
                   if (!aIsD && !aHasMian && bIsD) return 1;
                   
                   // 其次 -T
                   if (aIsT && !bIsT && !bHasMian && !aIsD) return -1;
                   if (!aIsT && !aHasMian && !aIsD && bIsT) return 1;
                   
                   // 最後 "免"
                   if (aHasMian && !bHasMian && !aIsD && !aIsT) return -1;
                   if (!aHasMian && !bHasMian && bHasMian) return 1;
                 }
                 
                 return 0;
               });

               // 計算總批數
               let totalReceivedBatches = 0;
               let totalReturnedBatches = 0;
              const receivedQuantitiesList: string[] = [];
              const returnedQuantitiesList: string[] = [];

              for (const vendor of sortedVendors) {
                const receivedBatches = typeof vendor.receivedBatches === 'string' ? parseInt(vendor.receivedBatches) || 0 : vendor.receivedBatches;
                const returnedBatches = typeof vendor.returnedBatches === 'string' ? parseInt(vendor.returnedBatches) || 0 : vendor.returnedBatches;
                totalReceivedBatches += receivedBatches;
                totalReturnedBatches += returnedBatches;
                if (vendor.receivedQuantity) {
                  receivedQuantitiesList.push(vendor.receivedQuantity);
                }
                if (vendor.returnedQuantity) {
                  returnedQuantitiesList.push(vendor.returnedQuantity);
                }
              }

              // 創建一個合併的記錄
              const mergedEntry: QualityAnalysisData = {
                ...entry,
                vendorName: baseVendorName, // 使用主廠商名稱
                receivedBatches: totalReceivedBatches, // 使用總批數
                returnedBatches: totalReturnedBatches, // 使用總批數
                receivedQuantity: receivedQuantitiesList.join('\n'), // 用換行符分隔
                returnedQuantity: returnedQuantitiesList.join('\n'), // 用換行符分隔
              };

              mergedResults.push(mergedEntry);
            }
          }

          processedVendors.add(vendorName);
        }

        try { console.log('[excelParser] merged entries:', mergedResults.length); } catch {}
        
        const firstEntry = rawResults[0] as QualityAnalysisData & { _parsedYear?: number | null; _parsedQuarter?: string | null };
        const result: { 
          data: QualityAnalysisData[]; 
          parsedYear?: number | null; 
          parsedQuarter?: string | null;
        } = {
          data: mergedResults,
          parsedYear: firstEntry?._parsedYear ?? null,
          parsedQuarter: firstEntry?._parsedQuarter ?? null,
        };
        resolve(result);
      } catch (error) {
        reject(new Error('解析Excel檔案時發生錯誤'));
      }
    };

    reader.onerror = () => reject(new Error('讀取檔案時發生錯誤'));
    reader.readAsArrayBuffer(file);
  });
};

export const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, fileName);
};













