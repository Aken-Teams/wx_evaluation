/**
 * 數值處理工具函數
 */

/**
 * 四捨五入到小數點第3位
 * @param value 要處理的數值
 * @returns 四捨五入到小數點第3位的數值
 */
export const roundTo3Decimals = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return 0;
  }
  
  return Math.round(numValue * 1000) / 1000;
};

/**
 * 安全地轉換為數值並四捨五入到小數點第3位
 * @param value 要處理的值
 * @param defaultValue 預設值，當轉換失敗時使用
 * @returns 處理後的數值
 */
export const safeNumberRound3 = (value: any, defaultValue: number = 0): number => {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return defaultValue;
  }
  
  return roundTo3Decimals(numValue);
};

/**
 * 處理數值陣列，將每個元素四捨五入到小數點第3位
 * @param values 數值陣列
 * @returns 處理後的數值陣列
 */
export const roundArrayTo3Decimals = (values: (number | string | null | undefined)[]): number[] => {
  return values.map(value => roundTo3Decimals(value));
};

/**
 * 處理物件中的數值欄位，將指定欄位四捨五入到小數點第3位
 * @param obj 要處理的物件
 * @param numericFields 需要處理的數值欄位名稱陣列
 * @returns 處理後的物件
 */
export const roundObjectFieldsTo3Decimals = <T extends Record<string, any>>(
  obj: T, 
  numericFields: (keyof T)[]
): T => {
  const result = { ...obj };
  
  numericFields.forEach(field => {
    if (field in result) {
      result[field] = roundTo3Decimals(result[field]) as T[keyof T];
    }
  });
  
  return result;
};


