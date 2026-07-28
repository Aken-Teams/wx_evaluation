-- AlterTable: 新增「是否AU」文字欄位（供應商是否為 AU），可為空、無預設
ALTER TABLE `va_SQMVQMVendor` ADD COLUMN `isAU` VARCHAR(191) NULL;
