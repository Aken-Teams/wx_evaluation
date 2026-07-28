import * as XLSX from 'xlsx';

/**
 * 導出數據為 CSV 格式
 */
export const exportToCSV = (data: any[], filename: string = 'data') => {
  if (!data || data.length === 0) {
    alert('沒有數據可導出');
    return;
  }

  // 獲取所有唯一的鍵（列名）
  const allKeys = new Set<string>();
  data.forEach(item => {
    Object.keys(item).forEach(key => allKeys.add(key));
  });
  const headers = Array.from(allKeys);

  // 構建 CSV 內容
  const csvRows: string[] = [];
  
  // 添加標題行
  csvRows.push(headers.map(h => `"${h}"`).join(','));

  // 添加數據行
  data.forEach(item => {
    const row = headers.map(header => {
      const value = item[header];
      if (value === null || value === undefined) {
        return '""';
      }
      // 處理包含逗號、引號或換行的值
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    });
    csvRows.push(row.join(','));
  });

  // 創建 Blob 並下載
  const csvContent = csvRows.join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().getTime()}.csv`;
  link.click();
};

/**
 * 導出數據為 Excel 格式
 */
export const exportToExcel = (
  data: any[],
  filename: string = 'data',
  sheetName: string = '數據'
) => {
  if (!data || data.length === 0) {
    alert('沒有數據可導出');
    return;
  }

  try {
    // 轉換數據格式
    const worksheetData = data.map(item => {
      const row: any = {};
      Object.keys(item).forEach(key => {
        const value = item[key];
        // 處理 null/undefined
        if (value === null || value === undefined) {
          row[key] = '';
        } else if (typeof value === 'number') {
          row[key] = value;
        } else {
          row[key] = String(value);
        }
      });
      return row;
    });

    // 創建工作表
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    
    // 設置列寬
    const maxWidth = 20;
    const wscols = Object.keys(worksheetData[0] || {}).map(() => ({
      wch: maxWidth
    }));
    worksheet['!cols'] = wscols;

    // 創建工作簿
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // 下載文件
    XLSX.writeFile(workbook, `${filename}_${new Date().getTime()}.xlsx`);
  } catch (error) {
    console.error('導出 Excel 失敗:', error);
    alert('導出 Excel 失敗，請重試');
  }
};

/**
 * 導出多個數據集為多個工作表
 */
export const exportMultipleSheetsToExcel = (
  sheets: Array<{ name: string; data: any[] }>,
  filename: string = 'data'
) => {
  if (!sheets || sheets.length === 0) {
    alert('沒有數據可導出');
    return;
  }

  try {
    const workbook = XLSX.utils.book_new();

    sheets.forEach(({ name, data }) => {
      if (!data || data.length === 0) return;

      const worksheetData = data.map(item => {
        const row: any = {};
        Object.keys(item).forEach(key => {
          const value = item[key];
          if (value === null || value === undefined) {
            row[key] = '';
          } else if (typeof value === 'number') {
            row[key] = value;
          } else {
            row[key] = String(value);
          }
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      
      // 設置列寬
      if (worksheetData.length > 0) {
        const wscols = Object.keys(worksheetData[0]).map(() => ({ wch: 20 }));
        worksheet['!cols'] = wscols;
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, name);
    });

    XLSX.writeFile(workbook, `${filename}_${new Date().getTime()}.xlsx`);
  } catch (error) {
    console.error('導出 Excel 失敗:', error);
    alert('導出 Excel 失敗，請重試');
  }
};



