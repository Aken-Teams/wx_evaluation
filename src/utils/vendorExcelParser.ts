﻿﻿﻿﻿﻿﻿﻿﻿﻿import * as XLSX from 'xlsx';

export interface VendorImportData {
  name: string;
  vendorType?: string; // 向后兼容（仍会发送到后端，但后端会以 region 为准）
  supplierCode?: string;
  materialCategory?: string;
  region?: string; // 供应商类型：国内 / 国外 / 海外
  isAU?: string; // 是否AU（自由文字）
}

export const parseVendorExcelFile = async (file: File): Promise<VendorImportData[]> => {
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
        const results: VendorImportData[] = [];

        const normalize = (s: any) => (s ?? '').toString().toLowerCase().replace(/[\s\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/g, '');

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) continue;

          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
          
          if (jsonData.length < 2) continue;

          const firstRow = (jsonData[0] as any[]) || [];
          
          // 供应商名称
          const nameColIndex = firstRow.findIndex(cell => {
            const normalized = normalize(cell);
            return normalized.includes('供应商') || normalized.includes('供應商') || 
                   normalized.includes('vendor') || normalized.includes('name') || 
                   normalized.includes('名称') || normalized.includes('名稱');
          });

          // 供应商编号
          const codeColIndex = firstRow.findIndex(cell => {
            const normalized = normalize(cell);
            return normalized.includes('编号') || normalized.includes('編號') || 
                   normalized.includes('code') || normalized.includes('suppliercode') || 
                   normalized.includes('supplier');
          });

          // 物料类别
          const categoryColIndex = firstRow.findIndex(cell => {
            const normalized = normalize(cell);
            return normalized.includes('物料') || normalized.includes('类别') || 
                   normalized.includes('類別') || normalized.includes('material') || 
                   normalized.includes('category');
          });

          // 供应商类型（支持多种列名：地区/类型/region/type）
          const regionColIndex = firstRow.findIndex(cell => {
            const normalized = normalize(cell);
            return normalized.includes('类型') || normalized.includes('類型') ||
                   normalized.includes('地区') || normalized.includes('地區') ||
                   normalized.includes('region') || normalized.includes('type') ||
                   normalized.includes('area') || normalized.includes('country');
          });

          // 是否AU（支持列名：是否AU / AU）
          const isAUColIndex = firstRow.findIndex(cell => {
            const normalized = normalize(cell);
            return normalized.includes('是否au') || normalized === 'au' || normalized.includes('au');
          });

          if (nameColIndex === -1) {
            reject(new Error('未能找到供應商名稱列，請確認Excel格式是否正確'));
            return;
          }

          for (let i = 1; i < jsonData.length; i++) {
            const row = (jsonData[i] as any[]) || [];
            const name = (row[nameColIndex] ?? '').toString().trim();
            
            if (!name) continue;

            // 解析供应商编号
            let supplierCode = '';
            if (codeColIndex !== -1) {
              supplierCode = (row[codeColIndex] ?? '').toString().trim();
            }

            // 解析物料类别
            let materialCategory = '';
            if (categoryColIndex !== -1) {
              materialCategory = (row[categoryColIndex] ?? '').toString().trim();
            }

            // 解析供应商类型（国内/国外/海外）
            let rawType = '';
            if (regionColIndex !== -1) {
              rawType = (row[regionColIndex] ?? '').toString().trim();
            }

            // 归一化：国外/海外（海外、国外、外国、foreign、international）-> 海外 或 国外
            // 其他（国内、中国、domestic、空）-> 国内
            let region = '国内';
            const normalizedType = normalize(rawType);
            if (normalizedType) {
              if (normalizedType.includes('海外') || normalizedType === 'haiwai') {
                region = '海外';
              } else if (normalizedType.includes('国外') || normalizedType.includes('foreign') ||
                         normalizedType.includes('international') || normalizedType.includes('外国')) {
                region = '国外';
              } else {
                region = '国内';
              }
            }

            // 解析是否AU（自由文字，原样保留）
            let isAU = '';
            if (isAUColIndex !== -1) {
              isAU = (row[isAUColIndex] ?? '').toString().trim();
            }

            results.push({
              name,
              supplierCode: supplierCode || '',
              materialCategory: materialCategory || '',
              region: region,
              isAU
            });
          }
        }

        if (results.length === 0) {
          reject(new Error('未能從檔案解析到任何供應商資料'));
          return;
        }

        resolve(results);
      } catch (error) {
        reject(new Error('解析Excel檔案時發生錯誤'));
      }
    };

    reader.onerror = () => reject(new Error('讀取檔案時發生錯誤'));
    reader.readAsArrayBuffer(file);
  });
};
