/**
 * 對拍測試（characterization）：用新評分引擎重算現有 DB 的每一筆季報，
 * 與資料庫「已儲存的舊系統計算結果」逐欄比對，報告一致率與差異。
 *
 * 前置：先啟動 SSH 通道  ->  .\db-tunnel.ps1 start
 * 執行：node scripts/characterize.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { evaluateQuarter, isAUVendor } from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 從 server/.env 讀 DATABASE_URL（避免把密碼寫死在此腳本）
const envPath = path.resolve(__dirname, '../../../server/.env');
const envText = readFileSync(envPath, 'utf8');
const dbUrl = (envText.match(/^DATABASE_URL=(.+)$/m) || [])[1]?.trim();
if (!dbUrl) throw new Error('server/.env 找不到 DATABASE_URL');
const u = new URL(dbUrl);
const conn = await mysql.createConnection({
  host: u.hostname,
  port: Number(u.port || 3306),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, ''),
});

const [rows] = await conn.query(`
  SELECT r.*, v.name AS vendorName, v.isAU AS isAUText
  FROM va_SQMVQMMonthlyReport r
  JOIN va_SQMVQMVendor v ON v.id = r.vendorId
  ORDER BY r.year, r.quarter, v.name
`);
await conn.end();

const EPS = 0.011; // 浮點容差（現有系統四捨五入至 2 位）
const num = (v) => (v === null || v === undefined ? null : Number(v));
const near = (a, b) => a === null && b === null ? true : a !== null && b !== null && Math.abs(a - b) <= EPS;

const fields = [
  { key: 'carScore', stored: 'totalBaseScoreB', label: 'CAR評分' },
  { key: 'qualityScore', stored: 'qualityAssessmentScoreC1', label: '品質總分' },
  { key: 'purchaseScore', stored: 'totalPurchaseAssessmentScoreA', label: '交期分數' },
  { key: 'assessmentScore', stored: 'assessmentScore', label: '綜合評分' },
];

const stats = Object.fromEntries(fields.map((f) => [f.key, { match: 0, mismatch: 0, mismatches: [] }]));
let total = 0;

for (const r of rows) {
  total++;
  const input = {
    receivedBatches: Number(r.receivedBatches) || 0,
    returnedBatches: Number(r.returnedBatches) || 0,
    externalCAR: Number(r.externalCAR) || 0,
    arr: Number(r.arr) || 0,
    untimelyResponseCCR: Number(r.untimelyResponseCCR) || 0,
    serviceQuality: Number(r.serviceQuality) || 0,
    servicePurchase: Number(r.servicePurchase) || 0,
    deliveryRate: r.deliveryRate === null ? null : Number(r.deliveryRate),
    specialApproval: Number(r.specialApproval) || 0,
    productionLineStop: Number(r.productionLineStop) || 0,
    isAU: isAUVendor(r.isAUText),
  };
  const out = evaluateQuarter(input);
  const engineVals = {
    carScore: out.quality?.carScore ?? null,
    qualityScore: out.quality?.qualityScore ?? null,
    purchaseScore: out.purchase?.purchaseScore ?? null,
    assessmentScore: out.assessmentScore,
  };

  for (const f of fields) {
    const eng = engineVals[f.key];
    const sto = num(r[f.stored]);
    if (near(eng, sto)) stats[f.key].match++;
    else {
      stats[f.key].mismatch++;
      if (stats[f.key].mismatches.length < 6) {
        stats[f.key].mismatches.push(
          `  ${r.year}-${r.quarter} ${r.vendorName}: 引擎=${eng} vs 存檔=${sto} (批數${input.receivedBatches}/退${input.returnedBatches} 客訴${input.externalCAR} 達交${input.deliveryRate} 服務${input.serviceQuality}+${input.servicePurchase})`,
        );
      }
    }
  }
}

console.log(`\n===== 對拍結果（共 ${total} 筆季報）=====\n`);
for (const f of fields) {
  const s = stats[f.key];
  const rate = total ? ((s.match / total) * 100).toFixed(1) : '0';
  const mark = s.mismatch === 0 ? '✅' : '⚠️';
  console.log(`${mark} ${f.label.padEnd(6)} 一致 ${s.match}/${total} (${rate}%)  不一致 ${s.mismatch}`);
  if (s.mismatches.length) console.log(s.mismatches.join('\n'));
}
console.log('');
