/**
 * 統一狀態訊息模板
 * 
 * 用於統一所有模組的狀態訊息格式，確保使用者體驗一致
 */

export type ModuleType = 'SQM' | 'OSAT';

/**
 * 格式化載入訊息
 * @param module 模組名稱（SQM 或 OSAT）
 * @param type 類型（yearly 或 monthly）
 * @param year 年度
 * @param month 月份（可選，僅 monthly 時需要）
 * @returns 格式化的載入訊息
 */
export const formatLoadingMessage = (
  module: ModuleType,
  type: 'yearly' | 'monthly',
  year: string,
  month?: string
): string => {
  if (type === 'yearly') {
    return `正在載入 ${module} ${year} 年度評鑑資料…`;
  } else {
    if (!month) {
      return `正在載入 ${module} ${year} 年月評鑑資料…`;
    }
    // 確保月份是兩位數
    const monthStr = month.padStart(2, '0');
    return `正在載入 ${module} ${year} 年 ${monthStr} 月月評鑑資料…`;
  }
};

/**
 * 格式化成功訊息
 * @param action 動作名稱（例如：儲存、上傳、載入）
 * @param result 結果說明
 * @returns 格式化的成功訊息
 */
export const formatSuccessMessage = (action: string, result: string): string => {
  return `${action}完成：${result}`;
};

/**
 * 格式化錯誤訊息
 * @param action 動作名稱（例如：載入、儲存、上傳）
 * @param reason 原因說明（使用者可理解的語言）
 * @param suggestion 建議（可選）
 * @returns 格式化的錯誤訊息
 */
export const formatErrorMessage = (
  action: string,
  reason: string,
  suggestion?: string
): string => {
  let message = `${action}失敗：${reason}`;
  if (suggestion) {
    message += ` ${suggestion}`;
  }
  return message;
};

/**
 * 預定義的成功訊息
 */
export const SuccessMessages = {
  saveYearly: (module: ModuleType, year: string) => 
    formatSuccessMessage('儲存', `${module} ${year} 年度評鑑已寫入後端`),
  
  saveMonthly: (module: ModuleType, year: string, month: string) => {
    const monthStr = month.padStart(2, '0');
    return formatSuccessMessage('儲存', `${module} ${year} 年 ${monthStr} 月月評鑑已寫入後端`);
  },
  
  uploadFile: (count: number, type: string) => 
    formatSuccessMessage('上傳', `成功匯入 ${count} 筆${type}`),
  
  uploadComplete: (successCount: number, type: string) => 
    formatSuccessMessage('上傳', `成功匯入 ${successCount} 筆${type}`),
};

/**
 * 預定義的錯誤訊息（使用者可理解的版本）
 */
export const ErrorMessages = {
  loadYearly: (module: ModuleType, year: string, reason: string = '伺服器暫時無法回應') => 
    formatErrorMessage(
      `載入 ${module} ${year} 年度評鑑資料`,
      reason,
      '請稍後再試或聯絡管理員'
    ),
  
  loadMonthly: (module: ModuleType, year: string, month: string, reason: string = '伺服器暫時無法回應') => {
    const monthStr = month.padStart(2, '0');
    return formatErrorMessage(
      `載入 ${module} ${year} 年 ${monthStr} 月資料`,
      reason,
      '請稍後再試或聯絡管理員'
    );
  },
  
  saveYearly: (module: ModuleType, year: string, reason: string = '伺服器暫時無法回應') => 
    formatErrorMessage(
      `儲存 ${module} ${year} 年度評鑑`,
      reason,
      '請稍後再試或聯絡管理員'
    ),
  
  saveMonthly: (module: ModuleType, year: string, month: string, reason: string = '伺服器暫時無法回應') => {
    const monthStr = month.padStart(2, '0');
    return formatErrorMessage(
      `儲存 ${module} ${year} 年 ${monthStr} 月月評鑑`,
      reason,
      '請稍後再試或聯絡管理員'
    );
  },
  
  uploadFile: (reason: string) => 
    formatErrorMessage('上傳', reason),
  
  uploadFormatError: () => 
    formatErrorMessage(
      '上傳',
      '檔案欄位名稱或順序與範本不符',
      '請下載範本重新確認欄位'
    ),
  
  uploadValidationError: (details: string) => 
    formatErrorMessage('上傳', `檔案驗證失敗：${details}`),
  
  networkError: (action: string) => 
    formatErrorMessage(
      action,
      '無法連接到伺服器',
      '請檢查網路連線或聯絡管理員'
    ),
  
  databaseError: (action: string) => 
    formatErrorMessage(
      action,
      '系統暫時無法連到資料庫',
      '請稍後再試或聯絡管理員'
    ),
};

/**
 * 格式化空資料訊息
 * @param type 資料類型（例如：品質評鑑、採購評鑑、綜合評鑑、年度評鑑）
 * @param action 建議動作（例如：上傳檔案、產生資料）
 * @returns 格式化的空資料訊息
 */
export const formatEmptyStateMessage = (
  type: string,
  action?: string
): string => {
  if (action) {
    return `目前尚未產生${type}資料，${action}。`;
  }
  return `目前尚未產生${type}資料。`;
};

/**
 * 預定義的空資料訊息
 */
export const EmptyStateMessages = {
  qualityReport: (module: ModuleType = 'SQM') => 
    formatEmptyStateMessage(`${module} 品質評鑑報告`, '請先上傳品質評價分析表'),
  
  purchaseReport: (module: ModuleType = 'SQM') => 
    formatEmptyStateMessage(`${module} 採購評鑑報告`, '請先上傳品質評價分析表'),
  
  comprehensiveReport: (module: ModuleType = 'SQM') => 
    formatEmptyStateMessage(`${module} 綜合評鑑表`, '請先上傳品質評價分析表和採購評鑑報告'),
  
  yearlyEvaluation: (module: ModuleType, year: string) => 
    formatEmptyStateMessage(`${module} ${year} 年度評鑑`, '請先完成各季度評鑑資料'),
  
  suzhouQualityReport: () => 
    formatEmptyStateMessage('OSAT 蘇州品質評鑑報告', '請先上傳蘇州評鑑報告'),
  
  suzhouPurchaseReport: () => 
    formatEmptyStateMessage('OSAT 蘇州採購評鑑報告', '請先上傳蘇州評鑑報告'),
  
  suzhouComprehensiveReport: () => 
    formatEmptyStateMessage('OSAT 蘇州綜合評鑑表', '請先上傳蘇州評鑑報告'),
};

/**
 * 將技術錯誤轉換為使用者可理解的訊息
 * @param error 錯誤物件或錯誤訊息
 * @param action 動作名稱
 * @param module 模組名稱（可選）
 * @param year 年度（可選）
 * @param month 月份（可選）
 * @returns 使用者可理解的錯誤訊息
 */
export const translateError = (
  error: any,
  action: string,
  module?: ModuleType,
  year?: string,
  month?: string
): string => {
  // 如果是字串，直接返回
  if (typeof error === 'string') {
    return error;
  }
  
  // 從錯誤物件中提取訊息
  const errorMessage = error?.message || error?.response?.data?.message || '未知錯誤';
  const errorCode = error?.code || error?.response?.status;
  
  // 根據錯誤類型轉換
  if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND') {
    return ErrorMessages.networkError(action);
  }
  
  if (errorCode === 500 || errorMessage.includes('database') || errorMessage.includes('資料庫')) {
    return ErrorMessages.databaseError(action);
  }
  
  if (errorMessage.includes('format') || errorMessage.includes('格式') || errorMessage.includes('欄位')) {
    return ErrorMessages.uploadFormatError();
  }
  
  if (errorMessage.includes('validation') || errorMessage.includes('驗證')) {
    return ErrorMessages.uploadValidationError(errorMessage);
  }
  
  // 如果有模組和年度資訊，使用對應的錯誤訊息
  if (module && year) {
    if (month) {
      return ErrorMessages.loadMonthly(module, year, month, errorMessage);
    } else {
      return ErrorMessages.loadYearly(module, year, errorMessage);
    }
  }
  
  // 預設錯誤訊息
  return formatErrorMessage(action, errorMessage, '請稍後再試或聯絡管理員');
};

