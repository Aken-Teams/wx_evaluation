/**
 * 建立背調 + 比價的新資料表（只新增，IF NOT EXISTS，絕不動現有表）。
 * 需先啟動 SSH 通道。連線字串讀自 apps/api/.env。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(path.resolve(__dirname, '../../../apps/api/.env'), 'utf8');
const dbUrl = (envText.match(/^DATABASE_URL=(.+)$/m) || [])[1]?.trim();
const u = new URL(dbUrl);

const ddl = [
  `CREATE TABLE IF NOT EXISTS \`va_BackgroundCheck\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`vendorId\` INT NOT NULL,
    \`year\` INT NOT NULL,
    \`latePaymentCount\` INT NOT NULL DEFAULT 0,
    \`customerComplaintCount\` INT NOT NULL DEFAULT 0,
    \`qualityAbnormal8D\` INT NOT NULL DEFAULT 0,
    \`cooperationScore\` INT NULL,
    \`notes\` TEXT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE INDEX \`va_BackgroundCheck_vendorId_year_key\` (\`vendorId\`, \`year\`),
    INDEX \`BackgroundCheck_vendorId_fkey\` (\`vendorId\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`va_SourcingEvent\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`title\` VARCHAR(191) NOT NULL,
    \`itemName\` VARCHAR(191) NULL,
    \`description\` TEXT NULL,
    \`status\` VARCHAR(191) NOT NULL DEFAULT 'open',
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`va_SourcingQuote\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`eventId\` INT NOT NULL,
    \`supplierName\` VARCHAR(191) NOT NULL,
    \`stage\` VARCHAR(191) NOT NULL DEFAULT 'after',
    \`moldItems\` VARCHAR(191) NULL,
    \`moldPriceTaxed\` DOUBLE NULL,
    \`productUnitPrice\` DOUBLE NULL,
    \`unitPriceTotal\` DOUBLE NULL,
    \`sampleLeadTime\` VARCHAR(191) NULL,
    \`deliveryCycle\` VARCHAR(191) NULL,
    \`paymentTerms\` VARCHAR(191) NULL,
    \`moldPaymentTerms\` VARCHAR(191) NULL,
    \`priceTier\` VARCHAR(191) NULL,
    \`backgroundInfo\` TEXT NULL,
    \`evaluation\` TEXT NULL,
    \`isBest\` TINYINT(1) NOT NULL DEFAULT 0,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    INDEX \`SourcingQuote_eventId_idx\` (\`eventId\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
];

const conn = await mysql.createConnection({
  host: u.hostname,
  port: Number(u.port || 3306),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, ''),
});

for (const sql of ddl) {
  const name = sql.match(/`(va_\w+)`/)[1];
  await conn.query(sql);
  console.log('✅ ensured table', name);
}

const [tables] = await conn.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('va_BackgroundCheck','va_SourcingEvent','va_SourcingQuote')",
);
console.log('存在的新表:', tables.map((t) => Object.values(t)[0]).join(', '));
await conn.end();
