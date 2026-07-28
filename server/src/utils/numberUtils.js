/**
 * 數值處理工具函數
 */

/**
 * 四捨五入到小數點第3位
 * @param {number|string|null|undefined} value 要處理的數值
 * @returns {number} 四捨五入到小數點第3位的數值
 */
const roundTo3Decimals = (value) => {
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
 * @param {any} value 要處理的值
 * @param {number} defaultValue 預設值，當轉換失敗時使用
 * @returns {number} 處理後的數值
 */
const safeNumberRound3 = (value, defaultValue = 0) => {
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
 * 處理物件中的數值欄位，將指定欄位四捨五入到小數點第3位
 * @param {Object} obj 要處理的物件
 * @param {string[]} numericFields 需要處理的數值欄位名稱陣列
 * @returns {Object} 處理後的物件
 */
const roundObjectFieldsTo3Decimals = (obj, numericFields) => {
  const result = { ...obj };
  
  numericFields.forEach(field => {
    if (field in result) {
      result[field] = roundTo3Decimals(result[field]);
    }
  });
  
  return result;
};

export {
  roundTo3Decimals,
  safeNumberRound3,
  roundObjectFieldsTo3Decimals
};
