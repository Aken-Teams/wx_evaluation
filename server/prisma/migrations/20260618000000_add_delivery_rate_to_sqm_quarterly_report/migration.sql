-- AlterTable: 達交率改為手動輸入，需持久化儲存（0-100，可為 NULL 表示尚未填寫）
ALTER TABLE `va_SQMVQMMonthlyReport` ADD COLUMN `deliveryRate` DOUBLE NULL;
