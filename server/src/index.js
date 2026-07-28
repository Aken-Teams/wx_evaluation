﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import multer from 'multer'
import XLSX from 'xlsx'
import fetch from 'node-fetch'
import { roundTo3Decimals, safeNumberRound3 } from './utils/numberUtils.js'
import logger from './utils/logger.js'

// ES module中獲取__dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// 維護模式配置
const MAINTENANCE_CONFIG = {
  enabled: process.env.MAINTENANCE_MODE === 'true',
  defaultUser: {
    id: 1,
    username: process.env.MAINTENANCE_USERNAME || 'admin',
    password: process.env.MAINTENANCE_PASSWORD || 'admin123',
    role: 'admin',
    enabled: true
  },
  message: '系統維護中，部分功能可能受限'
};

const MAINTENANCE_DATA = {
  monthlyReports: [],
  yearlyEvaluations: [],
  users: [MAINTENANCE_CONFIG.defaultUser]
};

// 維護模式狀態變量
let maintenanceMode = false;

const isMaintenanceMode = () => maintenanceMode || MAINTENANCE_CONFIG.enabled;
const getMaintenanceUser = (username) => {
  if (username === MAINTENANCE_CONFIG.defaultUser.username) {
    return MAINTENANCE_CONFIG.defaultUser;
  }
  return null;
};

dotenv.config()
const app = express()

// 配置 multer 用於檔案上傳
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB 限制
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xlsm', '.xls'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支援 .xlsx, .xlsm, .xls 格式的檔案'), false);
    }
  }
});

// 嘗試初始化Prisma，如果失敗則進入維護模式
let prisma = null;

async function initializeDatabase() {
  try {
    prisma = new PrismaClient();
    // 測試數據庫連接
    await prisma.$connect();
    logger.info('✅ 數據庫連接成功');
    maintenanceMode = false;
    return false; // 不是維護模式
  } catch (error) {
    logger.warn('⚠️ 數據庫連接失敗，進入維護模式');
    logger.info('錯誤:', error.message);
    maintenanceMode = true;
    return true; // 是維護模式
  }
}

app.use(cors())
app.use(express.json())

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' })
}

async function ensureAdminSeed() {
  if (maintenanceMode) {
    logger.warn('⚠️ 維護模式：跳過管理員種子數據創建');
    return;
  }
  
  try {
    const admin = await prisma.user.findFirst({ where: { role: 'admin' } })
    if (!admin) {
      const hash = await bcrypt.hash('admin123', 10)
      await prisma.user.create({ data: { username: 'admin', password: hash, role: 'admin', enabled: true } })
      logger.info('Seeded default admin: admin/admin123 (請盡快修改)')
    }
  } catch (error) {
    logger.warn('⚠️ 無法創建管理員種子數據:', error.message);
  }
}

// 啟動時確保 va_SQMVQMVendor.isAU 欄位存在（部署若未執行 migrate deploy 時的安全網，冪等）
async function ensureVendorColumns() {
  if (!prisma) return;
  try {
    const rows = await prisma.$queryRaw`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'va_SQMVQMVendor'
        AND COLUMN_NAME = 'isAU'`;
    if (!rows || rows.length === 0) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `va_SQMVQMVendor` ADD COLUMN `isAU` VARCHAR(191) NULL"
      );
      logger.info('✅ 已新增 va_SQMVQMVendor.isAU 欄位');
    }
  } catch (e) {
    logger.warn('⚠️ ensureVendorColumns 失敗（若已由 migrate 建立可忽略）:', e.message);
  }
}

app.post('/api/auth/login', async (req, res) => {
  const schema = z.object({ username: z.string().min(1), password: z.string().min(1) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
  const { username, password } = parsed.data
  
  // 維護模式下的登入處理
  if (maintenanceMode) {
    const maintenanceUser = getMaintenanceUser(username);
    if (maintenanceUser && password === maintenanceUser.password) {
      const token = signToken({ 
        sub: maintenanceUser.id, 
        role: maintenanceUser.role, 
        username: maintenanceUser.username,
        maintenanceMode: true 
      });
      return res.json({ 
        token, 
        role: maintenanceUser.role, 
        username: maintenanceUser.username,
        maintenanceMode: true,
        message: '系統維護中，部分功能可能受限'
      });
    } else {
      return res.status(401).json({ 
        error: 'invalid_credentials',
        message: '維護模式：請使用預設帳號登入'
      });
    }
  }
  
  // 正常模式下的登入處理
  try {
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user || !user.enabled) return res.status(401).json({ error: 'invalid_credentials' })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' })
    logger.debug('🔍 登入成功 - 用戶:', { id: user.id, username: user.username, role: user.role });
    const token = signToken({ sub: user.id, role: user.role, username: user.username })
    res.json({ token, role: user.role, username: user.username })
  } catch (error) {
    logger.warn('⚠️ 登入時數據庫錯誤:', error.message);
    return res.status(500).json({ 
      error: 'database_error',
      message: '數據庫連接失敗，請稍後再試'
    });
  }
})

function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return required ? res.status(401).json({ error: 'unauthorized' }) : next()
    try {
      const payload = jwt.verify(token, JWT_SECRET)
      req.user = payload
      // 調試日誌：只在特定路由記錄
      if (req.path && (req.path.includes('/admin/osat-vendors') || req.path.includes('/admin/sqm-vqm-vendors'))) {
        logger.debug('🔍 Auth middleware - 解析的用戶信息:', {
          path: req.path,
          userId: payload.sub,
          role: payload.role,
          username: payload.username
        });
      }
      next()
    } catch {
      return res.status(401).json({ error: 'unauthorized' })
    }
  }
}

function roleAllowed(userRole, allowed) {
  if (!userRole) {
    logger.warn('⚠️ roleAllowed: userRole 為空或未定義');
    return false;
  }
  // 確保角色字符串比較（去除可能的空格）
  const normalizedRole = String(userRole).trim();
  const result = allowed.includes(normalizedRole);
  if (!result) {
    logger.warn('⚠️ roleAllowed: 角色不匹配', {
      userRole: normalizedRole,
      allowed: allowed,
      type: typeof normalizedRole
    });
  }
  return result;
}

app.get('/api/auth/me', auth(), async (req, res) => {
  res.json({ userId: req.user.sub, role: req.user.role, username: req.user.username })
})

// Auth: change own password
app.post('/api/auth/change-password', auth(), async (req, res) => {
  const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(6) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
  const { currentPassword, newPassword } = parsed.data
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } })
    if (!user || !user.enabled) return res.status(401).json({ error: 'unauthorized' })
    const ok = await bcrypt.compare(currentPassword, user.password)
    if (!ok) return res.status(401).json({ error: 'invalid_current_password' })
    const same = await bcrypt.compare(newPassword, user.password)
    if (same) return res.status(400).json({ error: 'password_unchanged' })
    const hash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: user.id }, data: { password: hash } })
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: 'server_error' })
  }
})

// Admin: manage users
app.get('/api/admin/users', auth(), async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' })
  const list = await prisma.user.findMany({ select: { id: true, username: true, role: true, enabled: true, createdAt: true } })
  res.json(list)
})

// Admin: reset user password
app.post('/api/admin/users/:id/reset-password', auth(), async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' })
  const id = Number(req.params.id)
  logger.info(`重置密碼請求: 用戶ID=${id}, 管理員=${req.user.username}`)
  
  try {
    // 檢查用戶是否存在
    const existingUser = await prisma.user.findUnique({ where: { id } })
    if (!existingUser) {
      logger.info(`用戶不存在: ID=${id}`)
      return res.status(404).json({ error: 'user_not_found' })
    }
    
    // 生成臨時密碼 (8位隨機字串)
    const tempPassword = Math.random().toString(36).slice(-4) + Math.random().toString(36).slice(-4)
    const hash = await bcrypt.hash(tempPassword, 10)
    
    const user = await prisma.user.update({ 
      where: { id }, 
      data: { password: hash },
      select: { id: true, username: true, role: true, enabled: true }
    })
    
    logger.info(`密碼重置成功: 用戶=${user.username}`)
    
    res.json({ 
      user: { id: user.id, username: user.username, role: user.role, enabled: user.enabled },
      tempPassword: tempPassword,
      message: `用戶 ${user.username} 的密碼已重置為臨時密碼，請通知用戶立即修改`
    })
  } catch (e) {
    logger.error('重置密碼錯誤:', e)
    return res.status(500).json({ error: 'server_error', details: e.message })
  }
})

app.post('/api/admin/users', auth(), async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' })
  const schema = z.object({ username: z.string().min(1), password: z.string().min(6), role: z.enum(['viewer','quality_yearly_editor','purchase_editor','admin']) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
  try {
    const { username, password, role } = parsed.data
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ data: { username, password: hash, role, enabled: true } })
    res.json({ id: user.id, username: user.username, role: user.role, enabled: user.enabled })
  } catch (e) {
    // unique constraint
    if (e && e.code === 'P2002') return res.status(409).json({ error: 'username_taken' })
    return res.status(500).json({ error: 'server_error' })
  }
})

// Helper: 归一化供应商类型，确保使用新的「国内/国外/海外」标准
// （供应商类型由数据库 region 字段承载，vendorType 仅为旧数据兼容）
function normalizeSupplierType(value) {
  if (!value) return '国内';
  const t = String(value).toLowerCase().trim();
  if (t === '海外' || t.includes('海外') || t === 'haiwai') {
    return '海外';
  }
  if (t.includes('国外') || t === 'foreign' || t.includes('foreign') ||
      t.includes('international') || t === '國外廠商' || t === '國外' || t.includes('外国')) {
    return '国外';
  }
  return '国内'; // 国内，國內廠商，domestic，空值，其他都归一为「国内」
}

// Helper: 「是否AU」為自由文字欄位，僅做去空白處理，空字串視為 null
function cleanIsAU(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s || null;
}

// Helper: 取得供应商最终类型（region 优先，否则回落 vendorType）
function getSupplierType(vendor) {
  if (vendor && vendor.region) return normalizeSupplierType(vendor.region);
  if (vendor && vendor.vendorType) return normalizeSupplierType(vendor.vendorType);
  return '国内';
}

// Helper: ensure vendor exists (使用預設值創建新供應商)
async function ensureSQMVQMVendorByName(name) {
  let v = await prisma.sQMVQMVendor.findUnique({ where: { name } })
  if (v) {
    // 若 region 为空但 vendorType 有值，自动迁移
    // 或 vendorType 仍为旧格式，保证 region 有值
    if (!v.region && v.vendorType) {
      const migratedRegion = normalizeSupplierType(v.vendorType);
      v = await prisma.sQMVQMVendor.update({
        where: { id: v.id },
        data: { region: migratedRegion }
      });
    }
    return v;
  }

  // 新供应商使用 region 字段承载供应商类型，预设为「国内」
  return prisma.sQMVQMVendor.create({
    data: {
      name,
      vendorType: '国内',
      region: '国内' // 供应商类型（国内/国外/海外）
    }
  })
}

// 只查找供應商，不自動新增（用於驗證）
async function getSQMVQMVendorByName(name) {
  return await prisma.sQMVQMVendor.findUnique({ where: { name } })
}

async function ensureOSATVendorByName(name) {
  let v = await prisma.oSATVendor.findUnique({ where: { name } })
  if (v) return v
  return prisma.oSATVendor.create({ data: { name } })
}

// 只查找供應商，不自動新增（用於驗證）
async function getOSATVendorByName(name) {
  return await prisma.oSATVendor.findUnique({ where: { name } })
}

// SQM/VQM 供應商 → 物料類別 對照（僅需登入，供報告頁做物料類別欄位顯示與篩選）
app.get('/api/sqm-vqm/vendor-categories', auth(), async (req, res) => {
  if (maintenanceMode || !prisma) return res.json([])
  try {
    const vendors = await prisma.sQMVQMVendor.findMany({
      select: { name: true, materialCategory: true, isAU: true },
      orderBy: { name: 'asc' },
    })
    res.json(vendors) // [{ name, materialCategory, isAU }]
  } catch (error) {
    logger.info('獲取SQM/VQM供應商物料類別對照錯誤:', error.message)
    res.status(500).json({ error: '獲取物料類別對照失敗' })
  }
})

// SQM/VQM Quarterly reports
app.get('/api/sqm-vqm/quarterly/:year/:quarter', auth(), async (req, res) => {
  const year = Number(req.params.year)
  const quarter = req.params.quarter
  const items = await prisma.sQMVQMMonthlyReport.findMany({
    where: { year, quarter },
    include: { vendor: true },
    orderBy: { id: 'asc' },
  })
  const data = items.map((m) => ({ ...m, vendorName: m.vendor.name }))
  res.json(data)
})

app.put('/api/sqm-vqm/quarterly/:year/:quarter', auth(), async (req, res) => {
  const year = Number(req.params.year)
  const quarter = req.params.quarter
  logger.info(`📥 SQM/VQM 季度保存请求: year=${year}, quarter=${quarter}, user=${req.user?.username}, role=${req.user?.role}`);
  // allow editors: quality_yearly_editor, purchase_editor, admin
  if (!roleAllowed(req.user.role, ['quality_yearly_editor', 'purchase_editor', 'admin'])) {
    logger.warn(`❌ 权限不足: ${req.user?.username} (${req.user?.role})`);
    return res.status(403).json({ error: 'forbidden' })
  }
  const arr = Array.isArray(req.body) ? req.body : []
  logger.info(`📦 接收数据: ${arr.length} 条记录`);
  
  // 供應商名稱驗證（必須先驗證，不允許自動新增）
  if (arr.length > 0) {
    const vendorNames = arr.map(item => item.vendorName).filter(name => name);
    const validation = await validateVendors(vendorNames, 'sqm-vqm');
    
    if (!validation.valid) {
      return res.status(400).json({
        error: 'vendor_validation_failed',
        message: validation.message,
        invalidVendors: validation.invalidVendors,
        existingVendors: validation.existingVendors
      });
    }
  }
  
  try {
    const keptVendorIds = [];
    for (const item of arr) {
      // 只查找供應商，不自動新增（因為已經通過驗證）
      const v = await getSQMVQMVendorByName(item.vendorName);
      if (!v) {
        return res.status(400).json({
          error: 'vendor_not_found',
          message: `供應商 "${item.vendorName}" 不存在於供應商管理清單中`,
          invalidVendors: [item.vendorName]
        });
      }
      keptVendorIds.push(v.id);
      const lateDelivery = Math.max(0, roundTo3Decimals(Number(item.lateDelivery ?? 0)))
      // 達交率：手動輸入，0-100，允許 null（尚未填寫）
      const deliveryRate = (item.deliveryRate === null || item.deliveryRate === undefined || item.deliveryRate === '')
        ? null
        : Math.max(0, Math.min(100, roundTo3Decimals(Number(item.deliveryRate))))
      const specialApproval = Math.max(0, roundTo3Decimals(Number(item.specialApproval ?? 0)))
      const productionLineStop = Math.max(0, roundTo3Decimals(Number(item.productionLineStop ?? 0)))
      const excessFreight = Math.max(0, roundTo3Decimals(Number(item.excessFreight ?? 0)))
      await prisma.sQMVQMMonthlyReport.upsert({
        where: { year_quarter_vendorId: { year, quarter, vendorId: v.id } },
        update: {
          receivedQuantity: item.receivedQuantity ?? '0',
          returnedQuantity: item.returnedQuantity ?? '0',
          receivedBatches: roundTo3Decimals(Number(item.receivedBatches ?? 0)),
          returnedBatches: roundTo3Decimals(Number(item.returnedBatches ?? 0)),
          arr: roundTo3Decimals(Number(item.arr ?? 0)),
          lrr: roundTo3Decimals(Number(item.lrr ?? 0)),
          externalCAR: roundTo3Decimals(Number(item.externalCAR ?? 0)),
          untimelyResponseCCR: roundTo3Decimals(Number(item.untimelyResponseCCR ?? 0)),
          others: roundTo3Decimals(Number(item.others ?? 0)),
          totalBaseScoreB: item.totalBaseScoreB ?? null,
          qualityAssessmentScoreC1: item.qualityAssessmentScoreC1 ?? null,
          qualityAssessmentScoreC: item.qualityAssessmentScoreC ?? null,
          serviceQuality: roundTo3Decimals(Number(item.serviceQuality ?? 0)),
          lateDelivery,
          deliveryRate,
          specialApproval,
          productionLineStop,
          excessFreight,
          purchaseAssessmentScoreA: item.purchaseAssessmentScoreA ?? null,
          totalPurchaseAssessmentScoreA: item.totalPurchaseAssessmentScoreA ?? null,
          servicePurchase: roundTo3Decimals(Number(item.servicePurchase ?? item.service ?? 0)),
          assessmentScore: item.assessmentScore ?? null,
          remarks: item.remarks ?? null,
        },
        create: {
          year,
          quarter,
          vendorId: v.id,
          receivedQuantity: item.receivedQuantity ?? '0',
          returnedQuantity: item.returnedQuantity ?? '0',
          receivedBatches: roundTo3Decimals(Number(item.receivedBatches ?? 0)),
          returnedBatches: roundTo3Decimals(Number(item.returnedBatches ?? 0)),
          arr: roundTo3Decimals(Number(item.arr ?? 0)),
          lrr: roundTo3Decimals(Number(item.lrr ?? 0)),
          externalCAR: roundTo3Decimals(Number(item.externalCAR ?? 0)),
          untimelyResponseCCR: roundTo3Decimals(Number(item.untimelyResponseCCR ?? 0)),
          others: roundTo3Decimals(Number(item.others ?? 0)),
          totalBaseScoreB: item.totalBaseScoreB ?? null,
          qualityAssessmentScoreC1: item.qualityAssessmentScoreC1 ?? null,
          qualityAssessmentScoreC: item.qualityAssessmentScoreC ?? null,
          serviceQuality: roundTo3Decimals(Number(item.serviceQuality ?? 0)),
          lateDelivery,
          deliveryRate,
          specialApproval,
          productionLineStop,
          excessFreight,
          purchaseAssessmentScoreA: item.purchaseAssessmentScoreA ?? null,
          totalPurchaseAssessmentScoreA: item.totalPurchaseAssessmentScoreA ?? null,
          servicePurchase: roundTo3Decimals(Number(item.servicePurchase ?? item.service ?? 0)),
          assessmentScore: item.assessmentScore ?? null,
          remarks: item.remarks ?? null,
        },
      })
    }
    
    // 將 PUT 視為完整替換：刪除本季度中不在提交清單內的記錄
    // 空提交（清空季度資料）時 keptVendorIds 為空，刪除該季度所有記錄
    if (keptVendorIds.length === 0) {
      const del = await prisma.sQMVQMMonthlyReport.deleteMany({ where: { year, quarter } })
      logger.info(`🗑️ 清空 ${year} ${quarter} 季度資料，刪除 ${del.count} 條記錄`);
    } else {
      const del = await prisma.sQMVQMMonthlyReport.deleteMany({
        where: { year, quarter, vendorId: { notIn: keptVendorIds } },
      })
      if (del.count > 0) logger.info(`🗑️ ${year} ${quarter} 移除已刪除供應商 ${del.count} 條記錄`);
    }

    // 清除相關年份的緩存
    const cacheKey = `sqm-vqm-yearly-${year}`;
    if (cache.has(cacheKey)) {
      cache.delete(cacheKey);
      logger.debug(`🗑️ 清除緩存: ${cacheKey}`);
    }

    res.json({ ok: true })
  } catch (e) {
    logger.error('SQM/VQM 季評核儲存錯誤:', {
      error: e.message,
      stack: e.stack,
      year,
      quarter,
      itemCount: arr.length
    });
    res.status(500).json({ error: 'server_error', details: e.message })
  }
})

// OSAT Monthly reports
app.get('/api/osat/monthly/:year/:month', auth(), async (req, res) => {
  const year = Number(req.params.year)
  const month = Number(req.params.month)
  const factory = req.query.factory || 'gangshan' // 預設為岡山廠區
  
  const items = await prisma.oSATMonthlyReport.findMany({
    where: { year, month, factory },
    include: { vendor: true },
    orderBy: { id: 'asc' },
  })
  const data = items.map((m) => ({ ...m, vendorName: m.vendor.name }))
  res.json(data)
})

app.put('/api/osat/monthly/:year/:month', auth(), async (req, res) => {
  const year = Number(req.params.year)
  const month = Number(req.params.month)
  const factory = req.query.factory || 'gangshan' // 預設為岡山廠區
  // allow editors: quality_yearly_editor, purchase_editor, admin
  if (!roleAllowed(req.user.role, ['quality_yearly_editor', 'purchase_editor', 'admin'])) {
    return res.status(403).json({ error: 'forbidden' })
  }
  const arr = Array.isArray(req.body) ? req.body : []
  
  // 供應商名稱驗證（必須先驗證，不允許自動新增）
  if (arr.length > 0) {
    const vendorNames = arr.map(item => item.vendorName).filter(name => name);
    const validation = await validateVendors(vendorNames, 'osat');
    
    if (!validation.valid) {
      return res.status(400).json({
        error: 'vendor_validation_failed',
        message: validation.message,
        invalidVendors: validation.invalidVendors,
        existingVendors: validation.existingVendors
      });
    }
  }
  
  try {
    for (const item of arr) {
      // 只查找供應商，不自動新增（因為已經通過驗證）
      const v = await getOSATVendorByName(item.vendorName);
      if (!v) {
        return res.status(400).json({
          error: 'vendor_not_found',
          message: `供應商 "${item.vendorName}" 不存在於供應商管理清單中`,
          invalidVendors: [item.vendorName]
        });
      }
      const lateDelivery = Math.max(0, roundTo3Decimals(Number(item.lateDelivery ?? 0)))
      const specialApproval = Math.max(0, roundTo3Decimals(Number(item.specialApproval ?? 0)))
      const productionLineStop = Math.max(0, roundTo3Decimals(Number(item.productionLineStop ?? 0)))
      const excessFreight = Math.max(0, roundTo3Decimals(Number(item.excessFreight ?? 0)))
      const remarksValue = item.remarks ?? null;
      await prisma.oSATMonthlyReport.upsert({
        where: { year_month_vendorId_factory: { year, month, vendorId: v.id, factory } },
        update: {
          shipmentQuantity: item.shipmentQuantity ?? '0',
          receivedBatches: roundTo3Decimals(Number(item.receivedBatches ?? 0)),
          returnedBatches: roundTo3Decimals(Number(item.returnedBatches ?? 0)),
          totalComplaintCCR: roundTo3Decimals(Number(item.totalComplaintCCR ?? 0)),
          severeComplaintCCR: roundTo3Decimals(Number(item.severeComplaintCCR ?? 0)),
          generalComplaintCCR: roundTo3Decimals(Number(item.generalComplaintCCR ?? 0)),
          complaintRecurrenceCCR: roundTo3Decimals(Number(item.complaintRecurrenceCCR ?? 0)),
          groupCAR: roundTo3Decimals(Number(item.groupCAR ?? 0)),
          timelyResponseCCR: roundTo3Decimals(Number(item.timelyResponseCCR ?? 0)),
          untimelyResponseCCR: roundTo3Decimals(Number(item.untimelyResponseCCR ?? 0)),
          // 新的計算欄位
          incomingAcceptanceScoreA1: item.incomingAcceptanceScoreA1 ?? null,
          incomingAcceptanceScoreA: item.incomingAcceptanceScoreA ?? null,
          baseScoreB1: item.baseScoreB1 ?? null,
          baseScoreB2: item.baseScoreB2 ?? null,
          totalBaseScoreB: item.totalBaseScoreB ?? null,
          others: roundTo3Decimals(Number(item.others ?? 0)),
          qualityAssessmentScore: item.qualityAssessmentScore ?? null,
          qualityAssessmentScoreWeighted: item.qualityAssessmentScoreWeighted ?? null,
          serviceQuality: roundTo3Decimals(Number(item.serviceQuality ?? 0)),
          // 採購相關欄位保持不變
          lateDelivery,
          specialApproval,
          productionLineStop,
          excessFreight,
          purchaseAssessmentScoreA: item.purchaseAssessmentScoreA ?? null,
          totalPurchaseAssessmentScoreA: item.totalPurchaseAssessmentScoreA ?? null,
          servicePurchase: roundTo3Decimals(Number(item.servicePurchase ?? item.service ?? 0)),
          assessmentScore: item.assessmentScore ?? null,
          remarks: remarksValue,
        },
        create: {
          year,
          month,
          vendorId: v.id,
          factory,
          shipmentQuantity: item.shipmentQuantity ?? '0',
          receivedBatches: roundTo3Decimals(Number(item.receivedBatches ?? 0)),
          returnedBatches: roundTo3Decimals(Number(item.returnedBatches ?? 0)),
          totalComplaintCCR: roundTo3Decimals(Number(item.totalComplaintCCR ?? 0)),
          severeComplaintCCR: roundTo3Decimals(Number(item.severeComplaintCCR ?? 0)),
          generalComplaintCCR: roundTo3Decimals(Number(item.generalComplaintCCR ?? 0)),
          complaintRecurrenceCCR: roundTo3Decimals(Number(item.complaintRecurrenceCCR ?? 0)),
          groupCAR: roundTo3Decimals(Number(item.groupCAR ?? 0)),
          timelyResponseCCR: roundTo3Decimals(Number(item.timelyResponseCCR ?? 0)),
          untimelyResponseCCR: roundTo3Decimals(Number(item.untimelyResponseCCR ?? 0)),
          // 新的計算欄位
          incomingAcceptanceScoreA1: item.incomingAcceptanceScoreA1 ?? null,
          incomingAcceptanceScoreA: item.incomingAcceptanceScoreA ?? null,
          baseScoreB1: item.baseScoreB1 ?? null,
          baseScoreB2: item.baseScoreB2 ?? null,
          totalBaseScoreB: item.totalBaseScoreB ?? null,
          others: roundTo3Decimals(Number(item.others ?? 0)),
          qualityAssessmentScore: item.qualityAssessmentScore ?? null,
          qualityAssessmentScoreWeighted: item.qualityAssessmentScoreWeighted ?? null,
          serviceQuality: roundTo3Decimals(Number(item.serviceQuality ?? 0)),
          // 採購相關欄位保持不變
          lateDelivery,
          specialApproval,
          productionLineStop,
          excessFreight,
          purchaseAssessmentScoreA: item.purchaseAssessmentScoreA ?? null,
          totalPurchaseAssessmentScoreA: item.totalPurchaseAssessmentScoreA ?? null,
          servicePurchase: roundTo3Decimals(Number(item.servicePurchase ?? item.service ?? 0)),
          assessmentScore: item.assessmentScore ?? null,
          remarks: remarksValue,
        },
      })
    }
    
    // 清除相關年份的緩存
    const cacheKey = `osat-yearly-${year}`;
    if (cache.has(cacheKey)) {
      cache.delete(cacheKey);
      logger.debug(`🗑️ 清除緩存: ${cacheKey}`);
    }
    
    res.json({ ok: true })
  } catch (e) {
    logger.error('OSAT PUT 錯誤:', {
      error: e.message,
      year,
      month,
      factory,
      bodyLength: arr.length
    });
    res.status(500).json({ error: 'server_error', details: e.message })
  }
})

// SQM/VQM Annual inputs
app.get('/api/sqm-vqm/annual/:year', auth(), async (req, res) => {
  const year = Number(req.params.year)
  const items = await prisma.sQMVQMAnnualInput.findMany({ where: { year }, include: { vendor: true }, orderBy: { id: 'asc' } })
  const data = items.map((a) => ({ ...a, vendorName: a.vendor.name }))
  res.json(data)
})

app.put('/api/sqm-vqm/annual/:year', auth(), async (req, res) => {
  const year = Number(req.params.year)
  if (!roleAllowed(req.user.role, ['quality_yearly_editor', 'admin'])) {
    return res.status(403).json({ error: 'forbidden' })
  }
  const arr = Array.isArray(req.body) ? req.body : []
  
  // 供應商名稱驗證（必須先驗證，不允許自動新增）
  if (arr.length > 0) {
    const vendorNames = arr.map(item => item.vendorName).filter(name => name);
    const validation = await validateVendors(vendorNames, 'sqm-vqm');
    
    if (!validation.valid) {
      return res.status(400).json({
        error: 'vendor_validation_failed',
        message: validation.message,
        invalidVendors: validation.invalidVendors,
        existingVendors: validation.existingVendors
      });
    }
  }
  
  try {
    for (const item of arr) {
      // 只查找供應商，不自動新增（因為已經通過驗證）
      const v = await getSQMVQMVendorByName(item.vendorName);
      if (!v) {
        return res.status(400).json({
          error: 'vendor_not_found',
          message: `供應商 "${item.vendorName}" 不存在於供應商管理清單中`,
          invalidVendors: [item.vendorName]
        });
      }
      await prisma.sQMVQMAnnualInput.upsert({
        where: { year_vendorId: { year, vendorId: v.id } },
        update: {
          VDA: item.VDA ?? null,
          QSA: item.QSA ?? null,
          QPA: item.QPA ?? null,
          HSF: item.HSF ?? null,
          CSR: item.CSR ?? null,
          others: item.others ?? null,
          nextYearAuditType: item.nextYearAuditType ?? null,
          remarks: item.remarks ?? null,
        },
        create: {
          year,
          vendorId: v.id,
          VDA: item.VDA ?? null,
          QSA: item.QSA ?? null,
          QPA: item.QPA ?? null,
          HSF: item.HSF ?? null,
          CSR: item.CSR ?? null,
          others: item.others ?? null,
          nextYearAuditType: item.nextYearAuditType ?? null,
          remarks: item.remarks ?? null,
        },
      })
    }
    
    // 清除相關年份的緩存
    const cacheKey = `sqm-vqm-yearly-${year}`;
    if (cache.has(cacheKey)) {
      cache.delete(cacheKey);
      logger.debug(`🗑️ 清除緩存: ${cacheKey}`);
    }
    
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

// OSAT Annual inputs
app.get('/api/osat/annual/:year', auth(), async (req, res) => {
  const year = Number(req.params.year)
  const items = await prisma.oSATAnnualInput.findMany({ where: { year }, include: { vendor: true }, orderBy: { id: 'asc' } })
  const data = items.map((a) => ({ ...a, vendorName: a.vendor.name }))
  res.json(data)
})

app.put('/api/osat/annual/:year', auth(), async (req, res) => {
  const year = Number(req.params.year)
  if (!roleAllowed(req.user.role, ['quality_yearly_editor', 'admin'])) {
    return res.status(403).json({ error: 'forbidden' })
  }
  const arr = Array.isArray(req.body) ? req.body : []
  
  // 供應商名稱驗證（必須先驗證，不允許自動新增）
  if (arr.length > 0) {
    const vendorNames = arr.map(item => item.vendorName).filter(name => name);
    const validation = await validateVendors(vendorNames, 'osat');
    
    if (!validation.valid) {
      return res.status(400).json({
        error: 'vendor_validation_failed',
        message: validation.message,
        invalidVendors: validation.invalidVendors,
        existingVendors: validation.existingVendors
      });
    }
  }
  
  try {
    for (const item of arr) {
      // 只查找供應商，不自動新增（因為已經通過驗證）
      const v = await getOSATVendorByName(item.vendorName);
      if (!v) {
        return res.status(400).json({
          error: 'vendor_not_found',
          message: `供應商 "${item.vendorName}" 不存在於供應商管理清單中`,
          invalidVendors: [item.vendorName]
        });
      }
      await prisma.oSATAnnualInput.upsert({
        where: { year_vendorId: { year, vendorId: v.id } },
        update: {
          VDA: item.VDA ?? null,
          QSA: item.QSA ?? null,
          QPA: item.QPA ?? null,
          HSF: item.HSF ?? null,
          CSR: item.CSR ?? null,
          others: item.others ?? null,
          nextYearAuditType: item.nextYearAuditType ?? null,
          remarks: item.remarks ?? null,
        },
        create: {
          year,
          vendorId: v.id,
          VDA: item.VDA ?? null,
          QSA: item.QSA ?? null,
          QPA: item.QPA ?? null,
          HSF: item.HSF ?? null,
          CSR: item.CSR ?? null,
          others: item.others ?? null,
          nextYearAuditType: item.nextYearAuditType ?? null,
          remarks: item.remarks ?? null,
        },
      })
    }
    
    // 清除相關年份的緩存
    const cacheKey = `osat-yearly-${year}`;
    if (cache.has(cacheKey)) {
      cache.delete(cacheKey);
      logger.debug(`🗑️ 清除緩存: ${cacheKey}`);
    }
    
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

// 保存OSAT年度月採購量資料（不覆蓋月評核的進料批數）
app.put('/api/osat/yearly-purchase/:year', auth(), async (req, res) => {
  const year = Number(req.params.year)
  
  // 只允許 quality_yearly_editor, purchase_editor, admin 操作
  if (!roleAllowed(req.user.role, ['quality_yearly_editor', 'purchase_editor', 'admin'])) {
    return res.status(403).json({ error: 'forbidden' })
  }
  
  // 供應商名稱驗證（必須先驗證，不允許自動新增）
  const purchaseData = Array.isArray(req.body) ? req.body : [];
  
  if (purchaseData.length > 0) {
    const vendorNames = purchaseData.map(item => item.vendorName).filter(name => name);
    const validation = await validateVendors(vendorNames, 'osat');
    
    if (!validation.valid) {
      return res.status(400).json({
        error: 'vendor_validation_failed',
        message: validation.message,
        invalidVendors: validation.invalidVendors,
        existingVendors: validation.existingVendors
      });
    }
  }
  
  try {
    logger.info(`🔄 開始保存 ${year} 年度OSAT月採購量資料...`)
    logger.debug(`📊 收到 ${purchaseData.length} 筆月採購量資料`)
    
    let savedRecords = 0;
    
    // 處理每筆月採購量資料
    for (const item of purchaseData) {
      try {
        // 只查找供應商，不自動新增（因為已經通過驗證）
        const vendor = await getOSATVendorByName(item.vendorName);
        if (!vendor) {
          return res.status(400).json({
            error: 'vendor_not_found',
            message: `供應商 "${item.vendorName}" 不存在於供應商管理清單中`,
            invalidVendors: [item.vendorName]
          });
        }
        
        // 處理每個月的採購量資料
        for (let month = 1; month <= 12; month++) {
          const monthKey = `${month}月`;
          const purchaseQuantity = item[monthKey];
          
          // 如果有採購量資料，則儲存到資料庫
          if (purchaseQuantity !== null && purchaseQuantity !== undefined && purchaseQuantity !== '') {
            const quantity = parseFloat(purchaseQuantity);
            if (!isNaN(quantity) && quantity > 0) {
              await prisma.oSATMonthlyPurchase.upsert({
                where: {
                  year_month_vendorId: {
                    year: year,
                    month: month,
                    vendorId: vendor.id
                  }
                },
                update: {
                  purchaseQuantity: quantity
                },
                create: {
                  year: year,
                  month: month,
                  vendorId: vendor.id,
                  purchaseQuantity: quantity
                }
              });
              savedRecords++;
              logger.info(`✅ 儲存 ${item.vendorName} ${year}年${month}月 採購量: ${quantity}`);
            }
          }
        }
      } catch (itemError) {
        logger.error(`❌ 處理供應商 ${item.vendorName} 的月採購量資料失敗:`, itemError);
      }
    }
    
    logger.debug(`📊 總共儲存了 ${savedRecords} 筆月採購量記錄`)
    
    // 清除相關年份的緩存，讓年度評鑑重新計算
    const cacheKey = `osat-yearly-${year}`;
    if (cache.has(cacheKey)) {
      cache.delete(cacheKey);
      logger.debug(`🗑️ 清除緩存: ${cacheKey}`);
    }
    
    res.json({ 
      ok: true, 
      message: `已保存 ${year} 年度月採購量資料到資料庫`,
      affectedRecords: savedRecords,
      processedSuppliers: purchaseData.length
    })
    
  } catch (e) {
    logger.error('保存OSAT月採購量資料失敗:', e)
    res.status(500).json({ error: 'server_error', details: e.message })
  }
})

// 清除OSAT年度月採購量資料
app.delete('/api/osat/yearly-purchase/:year', auth(), async (req, res) => {
  const year = Number(req.params.year)
  
  // 只允許 quality_yearly_editor, purchase_editor, admin 操作
  if (!roleAllowed(req.user.role, ['quality_yearly_editor', 'purchase_editor', 'admin'])) {
    return res.status(403).json({ error: 'forbidden' })
  }
  
  try {
    logger.debug(`🗑️ 開始清除 ${year} 年度OSAT月採購量資料...`)
    
    // 清除OSATMonthlyPurchase資料表中的月採購量資料
    const result = await prisma.oSATMonthlyPurchase.deleteMany({
      where: { year }
    })
    
    logger.info(`✅ 清除完成: 影響 ${result.count} 條記錄`)
    
    // 清除相關年份的緩存
    const cacheKey = `osat-yearly-${year}`;
    if (cache.has(cacheKey)) {
      cache.delete(cacheKey);
      logger.debug(`🗑️ 清除緩存: ${cacheKey}`);
    }
    
    res.json({ 
      ok: true, 
      message: `已清除 ${year} 年度月採購量資料`,
      affectedRecords: result.count 
    })
    
  } catch (e) {
    logger.error('清除OSAT月採購量資料失敗:', e)
    res.status(500).json({ error: 'server_error', details: e.message })
  }
})

// 計算年度稽核組件（與SQM/VQM邏輯一致）：
// 有 VDA 分數時取「VDA 與 HSF」平均，無 VDA 時取「QSA 與 HSF」平均（僅計入已填寫的分項）
const getAuditComponent = (annualInput) => {
  if (!annualInput) return 0;

  const arr = [];
  // 優先使用VDA（VDA = 0 視為 null，VDA 不可能為 0，雙重保護）；否則改用 QSA
  if (typeof annualInput.VDA === 'number' && annualInput.VDA > 0) {
    arr.push(annualInput.VDA);
  } else if (typeof annualInput.QSA === 'number') {
    arr.push(annualInput.QSA);
  }
  // 併入 HSF（有填寫時），與 VDA/QSA 取平均
  if (typeof annualInput.HSF === 'number') arr.push(annualInput.HSF);

  if (arr.length > 0) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  return 0;
};

// 簡單的內存緩存機制
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分鐘緩存

// ========== AI 問答機器人相關功能 ==========

// 對話歷史存儲（內存存儲，格式：userId_systemType -> messages[]）
const chatHistory = new Map();

// Ollama API 配置（可被 AiLlmConfig 覆蓋）
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "https://ollama_pjapi.theaken.com";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || "YOUR_API_KEY";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2"; // 可配置模型名稱

/** 取得 LLM 設定（DB 覆蓋 env） */
async function getLlmConfig() {
  try {
    const rows = await prisma.aiLlmConfig.findMany();
    const map = {};
    rows.forEach(r => { map[r.configKey] = r.configVal; });
    return {
      apiUrl: map.OLLAMA_API_URL || OLLAMA_API_URL,
      model: map.OLLAMA_MODEL || OLLAMA_MODEL,
      apiKey: map.OLLAMA_API_KEY || OLLAMA_API_KEY
    };
  } catch {
    return { apiUrl: OLLAMA_API_URL, model: OLLAMA_MODEL, apiKey: OLLAMA_API_KEY };
  }
}

/**
 * 調用 Ollama API 進行對話
 */
async function chatWithOllama(messages, stream = false, maxTokens = 1000) {
  try {
    const config = await getLlmConfig();
    const response = await fetch(`${config.apiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        stream: stream,
        temperature: 0.3, // 降低溫度，使回答更準確
        max_tokens: maxTokens // 限制最大輸出長度，可根據查詢類型調整
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API 錯誤: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error('Ollama API 調用失敗:', error);
    throw error;
  }
}

/**
 * 模糊匹配供應商名稱
 */
function findMatchingVendor(questionText, allVendors) {
  if (!questionText || !allVendors || allVendors.length === 0) {
    return null;
  }
  
  const questionUpper = questionText.toUpperCase();
  
  // 1. 精確匹配 (不區分大小寫)
  let matched = allVendors.find(v => v.name.toUpperCase() === questionUpper);
  if (matched) return matched;

  // 2. 包含匹配 (雙向)
  matched = allVendors.find(v => {
    const vendorNameUpper = v.name.toUpperCase();
    return vendorNameUpper.includes(questionUpper) || questionUpper.includes(vendorNameUpper);
  });
  if (matched) return matched;

  // 3. 去除數字後匹配 (例如: "廣閎" 匹配 "廣閎100010")
  const questionWithoutNumbers = questionUpper.replace(/\d/g, '');
  if (questionWithoutNumbers.length > 1) {
    matched = allVendors.find(v => {
      const vendorNameWithoutNumbers = v.name.toUpperCase().replace(/\d/g, '');
      return vendorNameWithoutNumbers.includes(questionWithoutNumbers) || 
             questionWithoutNumbers.includes(vendorNameWithoutNumbers);
    });
    if (matched) return matched;
  }

  // 4. 前綴匹配
  matched = allVendors.find(v => v.name.toUpperCase().startsWith(questionUpper));
  if (matched) return matched;

  // 5. 相似度匹配 (字符重疊度 > 50%)
  matched = allVendors.find(v => {
    const vendorNameUpper = v.name.toUpperCase();
    const questionChars = [...new Set(questionUpper.split(''))];
    const vendorChars = [...new Set(vendorNameUpper.split(''))];
    const intersection = questionChars.filter(char => vendorChars.includes(char)).length;
    const union = new Set([...questionChars, ...vendorChars]).size;
    const similarity = union > 0 ? intersection / union : 0;
    return similarity > 0.5 && questionUpper.length > 1;
  });
  if (matched) return matched;

  return null;
}

/**
 * 解析問題，提取關鍵信息（供應商名稱、年份、月份等）
 */
function parseQuestion(question, systemType) {
  const result = {
    vendorName: null,
    year: null,
    month: null,
    startYear: null,
    startMonth: null,
    endYear: null,
    endMonth: null,
    dataType: null, // 'monthly', 'yearly', 'vendor_list', 'statistics', 'trend'
    queryType: null, // 'query', 'statistics', 'comparison', 'trend', 'ranking'
    auditType: null, // '免稽', '文件稽核', '現場稽核', '現場稽核+製程稽核', '無採購紀錄'
    auditTypes: null, // 多種稽核類型的數組，例如 ['文件稽核', '現場稽核', '免稽']
    needAllVendors: false // 是否需要查詢所有供應商
  };

  // 提取年份（支持多種格式，可能有多個年份）
  const yearMatches = question.match(/(\d{4})年?/g);
  if (yearMatches) {
    const years = yearMatches.map(m => parseInt(m.replace('年', '')));
    if (years.length === 1) {
      result.year = years[0];
      result.startYear = years[0];
      result.endYear = years[0];
    } else if (years.length >= 2) {
      result.startYear = years[0];
      result.endYear = years[years.length - 1];
    }
  }

  // 提取月份（支持多種格式，可能有多個月份）
  const monthMatches = question.match(/(\d{1,2})月|一月|二月|三月|四月|五月|六月|七月|八月|九月|十月|十一月|十二月/g);
  if (monthMatches) {
    const monthMap = {
      '一月': 1, '二月': 2, '三月': 3, '四月': 4, '五月': 5, '六月': 6,
      '七月': 7, '八月': 8, '九月': 9, '十月': 10, '十一月': 11, '十二月': 12
    };
    const months = monthMatches.map(m => {
      const monthText = m.replace('月', '');
      return monthMap[monthText] || parseInt(monthText);
    });
    
    if (months.length === 1) {
      result.month = months[0];
      result.startMonth = months[0];
      result.endMonth = months[0];
    } else if (months.length >= 2) {
      result.startMonth = months[0];
      result.endMonth = months[months.length - 1];
    }
  }

  // 提取日期範圍（例如：2025年1月到2026年1月）
  const rangeMatch = question.match(/(\d{4})年\s*(\d{1,2})月\s*[到至]\s*(\d{4})年\s*(\d{1,2})月/);
  if (rangeMatch) {
    result.startYear = parseInt(rangeMatch[1]);
    result.startMonth = parseInt(rangeMatch[2]);
    result.endYear = parseInt(rangeMatch[3]);
    result.endMonth = parseInt(rangeMatch[4]);
  }

  // 嘗試提取供應商名稱（簡單匹配，實際匹配會在查詢時進行模糊搜索）
  // 這裡只做標記，實際查詢時會使用問題中的關鍵詞進行模糊匹配

  // 判斷數據類型
  if (question.includes('趨勢') || question.includes('變化') || question.includes('走勢')) {
    result.dataType = 'trend';
    result.queryType = 'trend';
  } else if (question.includes('月評核') || question.includes('月評鑑') || question.includes('月報表') || question.includes('月數據')) {
    result.dataType = 'monthly';
  } else if (question.includes('年度') || question.includes('年評核') || question.includes('年評鑑') || question.includes('年數據')) {
    result.dataType = 'yearly';
  } else if (question.includes('供應商列表') || question.includes('有哪些供應商') || question.includes('供應商')) {
    result.dataType = 'vendor_list';
  } else if (question.includes('統計') || question.includes('平均') || question.includes('總計') || question.includes('分析')) {
    result.dataType = 'statistics';
  }

  // 判斷查詢類型
  // 先檢查是否需要比較所有供應商（優先級最高）
  if (question.includes('排名') || question.includes('排位') || question.includes('排序') || 
      question.includes('依據') && (question.includes('排名') || question.includes('排序'))) {
    result.queryType = 'ranking';
    result.needAllVendors = true;
  } else if (question.includes('哪一家') || question.includes('哪個') || question.includes('哪些') || 
      question.includes('變化最大') || question.includes('變化最小') || 
      question.includes('最大') || question.includes('最小') || question.includes('最高') || question.includes('最低')) {
    result.queryType = 'trend';
    result.needAllVendors = true;
    logger.info('✅ 檢測到需要查詢所有供應商進行比較');
  } else if (question.includes('趨勢') || question.includes('變化') || question.includes('走勢')) {
    result.queryType = 'trend';
  } else if (question.includes('比較') || question.includes('對比')) {
    result.queryType = 'comparison';
    result.needAllVendors = true;
  } else if (question.includes('統計') || question.includes('分析')) {
    result.queryType = 'statistics';
  } else {
    result.queryType = 'query';
  }

  // 檢測稽核類型相關查詢
  if (question.includes('下年度稽核計畫') || question.includes('稽核計畫') || question.includes('稽核類型')) {
    result.dataType = 'yearly';
    result.queryType = 'audit_type';
    result.needAllVendors = true; // 稽核類型查詢需要查詢所有供應商
    
    // 檢測問題中提到的所有稽核類型（支持多種類型同時查詢）
    const auditTypes = [];
    
    // 檢查是否包含"現場稽核+製程稽核"（需要同時包含兩個關鍵詞，OSAT 專用）
    if (question.includes('現場稽核') && question.includes('製程稽核')) {
      auditTypes.push('現場稽核+製程稽核');
    } else if (question.includes('現場稽核') || question.includes('实地稽核') || question.includes('實地稽核')) {
      // 兼容新舊術語：实地稽核（新）= 現場稽核（舊），兩種值都納入比對
      auditTypes.push('实地稽核', '現場稽核');
    }
    if (question.includes('文件稽核') || question.includes('文件审核') || question.includes('文件審核')) {
      // 兼容新舊術語：文件审核（新）= 文件稽核（舊），兩種值都納入比對
      auditTypes.push('文件审核', '文件稽核');
    }
    if (question.includes('免稽')) {
      auditTypes.push('免稽');
    }
    if (question.includes('無採購紀錄')) {
      auditTypes.push('無採購紀錄');
    }
    
    // 如果問題中包含"統計"、"各別"、"分別"等關鍵詞，且沒有明確提到類型，視為查詢所有類型
    const isStatisticsQuery = (question.includes('統計') || question.includes('各別') || 
                               question.includes('分別') || question.includes('各') || 
                               question.includes('有哪些') || question.includes('幾種')) && 
                               auditTypes.length === 0;
    
    // 如果只提到一種類型，設置 auditType；如果提到多種，設置 auditTypes 數組
    if (auditTypes.length === 1) {
      result.auditType = auditTypes[0];
      result.auditTypes = null; // 單一類型時不設置數組
    } else if (auditTypes.length > 1) {
      result.auditType = null; // 多種類型時不設置單一類型
      result.auditTypes = auditTypes; // 設置類型數組
    } else {
      // 沒有明確提到類型，可能是查詢所有類型（統計查詢或未指定類型）
      result.auditType = null;
      result.auditTypes = null;
      if (isStatisticsQuery) {
        // 標記為統計查詢，需要顯示所有類型
        result.queryType = 'audit_type_statistics';
      }
    }
    
    logger.info('✅ 檢測到稽核類型查詢:', {
      auditType: result.auditType,
      auditTypes: result.auditTypes,
      queryType: result.queryType,
      needAllVendors: result.needAllVendors,
      isStatisticsQuery: isStatisticsQuery,
      questionPreview: question.substring(0, 150), // 顯示問題的前150個字符用於調試
      has文件稽核: question.includes('文件稽核'),
      has現場稽核: question.includes('現場稽核'),
      has免稽: question.includes('免稽'),
      has無採購紀錄: question.includes('無採購紀錄')
    });
  }

  return result;
}

/**
 * 根據問題查詢數據庫
 */
async function queryDatabase(question, parsedInfo, systemType, userId) {
  const contextData = {
    systemType: systemType,
    vendors: [],
    monthlyReports: [],
    yearlyReports: [],
    statistics: {}
  };

  try {
    if (systemType === 'sqm-vqm') {
      // 查詢 SQM/VQM 供應商列表（查詢所有供應商，不限制數量）
      const vendors = await prisma.sQMVQMVendor.findMany({
        orderBy: { name: 'asc' }
      });
      contextData.vendors = vendors.map(v => ({
        name: v.name,
        type: v.vendorType
      }));

      // 注意：單個供應商的單筆查詢會在後面處理，這裡先不查詢所有數據

      // 如果有指定年份，查詢年度評核數據（包含計算字段）
      // 重要：需要查詢所有有月評核數據的供應商，而不僅僅是有年度輸入數據的供應商
      // 如果是稽核類型查詢，也需要查詢年度數據
      const queryYear = parsedInfo.year || parsedInfo.startYear;
      if ((queryYear && !parsedInfo.month) || parsedInfo.queryType === 'audit_type' || parsedInfo.queryType === 'audit_type_statistics') {
        const yearToQuery = queryYear || new Date().getFullYear();
        logger.debug(`🔍 查詢年度數據: ${yearToQuery}, 查詢類型: ${parsedInfo.queryType}`);
        
        // 查詢該年份的所有月評核數據，用於計算年度分數
        const allMonthlyReportsForYear = await prisma.sQMVQMMonthlyReport.findMany({
          where: { year: yearToQuery },
          include: { vendor: true },
          orderBy: [{ vendorId: 'asc' }, { month: 'asc' }]
        });
        
        // 查詢該年份的所有年度輸入數據
        const allAnnualInputs = await prisma.sQMVQMAnnualInput.findMany({
          where: { year: yearToQuery },
          include: { vendor: true }
        });
        
        // 建立年度輸入數據的索引（按vendorId）
        const annualInputsByVendor = {};
        allAnnualInputs.forEach(input => {
          annualInputsByVendor[input.vendorId] = input;
        });
        
        // 按供應商分組月評核數據
        const monthlyReportsByVendor = {};
        const vendorsWithMonthlyData = new Set();
        allMonthlyReportsForYear.forEach(report => {
          if (!monthlyReportsByVendor[report.vendorId]) {
            monthlyReportsByVendor[report.vendorId] = [];
            vendorsWithMonthlyData.add(report.vendorId);
          }
          monthlyReportsByVendor[report.vendorId].push(report);
        });
        
        // 如果是稽核類型查詢，需要包含所有供應商（即使沒有月度報告）
        // 否則只包含有月度報告的供應商
        let vendorsToProcess = [];
        if (parsedInfo.queryType === 'audit_type' || parsedInfo.queryType === 'audit_type_statistics') {
          // 查詢所有供應商
          const allVendorsForAudit = await prisma.sQMVQMVendor.findMany({
            orderBy: { name: 'asc' }
          });
          vendorsToProcess = allVendorsForAudit.map(v => ({ id: v.id, vendor: v }));
          logger.debug(`🔍 稽核類型查詢：包含所有供應商，共${allVendorsForAudit.length}家`);
        } else {
          // 只包含有月度報告的供應商
          vendorsToProcess = Array.from(vendorsWithMonthlyData).map(vendorId => {
            const monthlyReports = monthlyReportsByVendor[vendorId];
            return { id: vendorId, vendor: monthlyReports[0].vendor };
          });
          logger.debug(`🔍 年度查詢：只包含有月度報告的供應商，共${vendorsToProcess.length}家`);
        }
        
        // 為所有供應商計算年度分數
        contextData.yearlyReports = [];
        for (const { id: vendorId, vendor } of vendorsToProcess) {
          const monthlyReports = monthlyReportsByVendor[vendorId] || [];
          const annualInput = annualInputsByVendor[vendorId] || null;
          
          // 計算該供應商的月考核平均分數
          const assessmentScores = monthlyReports
            .map(report => report.assessmentScore)
            .filter(score => score !== null && score !== undefined);
          
          const monthlyAssessmentSummary = assessmentScores.length > 0
            ? roundTo3Decimals(assessmentScores.reduce((a, b) => a + b, 0) / assessmentScores.length)
            : null;
          
          // 計算年度分數
          const auditComponent = annualInput ? getAuditComponent(annualInput) : 0;
          const others = annualInput?.others ?? 0;
          const annualScore = monthlyAssessmentSummary !== null
            ? (() => {
                // 如果沒有年度稽核分數，只根據月考核分數計算（不扣分）
                if (auditComponent === 0) {
                  return roundTo3Decimals(monthlyAssessmentSummary - others);
                }
                return roundTo3Decimals((monthlyAssessmentSummary * 0.9) + (auditComponent * 0.1) - others);
              })()
            : null;
          
          // 計算等級
          const grade = annualScore !== null ? (() => {
            if (annualScore >= 95) return 'A';
            if (annualScore >= 85) return 'B';
            if (annualScore >= 75) return 'C';
            if (annualScore >= 60) return 'D';
            return 'E';
          })() : null;
          
          // 獲取下年度稽核類型
          // 優先使用數據庫中存儲的值（如果有的話）
          let nextYearAuditType = annualInput?.nextYearAuditType ?? null;
          let auditTypeSource = 'database'; // 標記數據來源
          
          // 只有在數據庫中沒有存儲的稽核類型時，才根據規則計算（作為備用方案）
          if (!nextYearAuditType) {
            // 純依供應商地區判定：国内 → 实地稽核；国外/海外 → 文件审核
            const supplierType = getSupplierType(vendor);
            const isForeign = supplierType === '国外' || supplierType === '海外';
            nextYearAuditType = isForeign ? '文件审核' : '实地稽核';

            auditTypeSource = 'calculated'; // 標記為計算得出
            logger.debug(`🔍 計算稽核類型（數據庫中無數據）: ${vendor.name}, 供應商地區=${supplierType}, 是否國外=${isForeign}, 稽核類型=${nextYearAuditType}`);
          } else {
            logger.info(`✅ 使用數據庫中的稽核類型: ${vendor.name}, 稽核類型=${nextYearAuditType}`);
          }
          
          contextData.yearlyReports.push({
            vendorName: vendor.name,
            year: yearToQuery,
            VDA: annualInput?.VDA ?? null,
            QSA: annualInput?.QSA ?? null,
            QPA: annualInput?.QPA ?? null,
            HSF: annualInput?.HSF ?? null,
            CSR: annualInput?.CSR ?? null,
            others: annualInput?.others ?? null,
            nextYearAuditType: nextYearAuditType,
            remarks: annualInput?.remarks ?? null,
            // 計算字段
            月考核平均: monthlyAssessmentSummary,
            monthlyAssessmentSummary: monthlyAssessmentSummary,
            年度分數: annualScore,
            annualScore: annualScore,
            等級: grade,
            grade: grade
          });
        }
        
        // 如果是稽核類型查詢，需要篩選（含統計查詢）
        if (parsedInfo.queryType === 'audit_type' || parsedInfo.queryType === 'audit_type_statistics') {
          // 先統計各種稽核類型的數量，用於調試和錯誤提示
          const auditTypeCounts = {};
          const sampleReports = [];
          contextData.yearlyReports.forEach((r, index) => {
            const type = r.nextYearAuditType || '(null)';
            auditTypeCounts[type] = (auditTypeCounts[type] || 0) + 1;
            // 保存前10個作為示例
            if (index < 10) {
              sampleReports.push({
                vendorName: r.vendorName,
                nextYearAuditType: r.nextYearAuditType,
                typeLength: (r.nextYearAuditType || '').length
              });
            }
          });
          logger.debug(`📊 稽核類型統計（篩選前）:`, auditTypeCounts);
          logger.debug(`📋 前10個供應商示例:`, sampleReports);
          
          // 如果指定了單一稽核類型，只篩選該類型
          if (parsedInfo.auditType) {
            logger.debug(`🔍 開始篩選單一稽核類型: "${parsedInfo.auditType}", 篩選前數量=${contextData.yearlyReports.length}`);
            
            // 保存統計信息到 contextData，以便在錯誤消息中使用
            contextData._auditTypeStats = {
              beforeCount: contextData.yearlyReports.length,
              requestedType: parsedInfo.auditType,
              availableTypes: auditTypeCounts
            };
            
            const beforeCount = contextData.yearlyReports.length;
            contextData.yearlyReports = contextData.yearlyReports.filter(r => {
              // 使用嚴格匹配，確保字符串完全一致
              const matches = r.nextYearAuditType === parsedInfo.auditType;
              return matches;
            });
            
            logger.info(`✅ 篩選後數量=${contextData.yearlyReports.length} (從 ${beforeCount} 筆中篩選)`);
            
            if (contextData.yearlyReports.length === 0) {
              logger.warn(`⚠️ 警告：篩選後沒有找到匹配的供應商！`);
              logger.info(`   查詢的稽核類型: "${parsedInfo.auditType}" (長度: ${parsedInfo.auditType.length}, 字符碼: ${Array.from(parsedInfo.auditType).map(c => c.charCodeAt(0)).join(',')})`);
              logger.info(`   可用的稽核類型:`, Object.keys(auditTypeCounts));
              logger.info(`   各類型數量:`, auditTypeCounts);
              // 檢查是否有相似的類型（用於調試）
              Object.keys(auditTypeCounts).forEach(type => {
                if (type !== '(null)') {
                  logger.info(`   類型 "${type}" (長度: ${type.length}, 字符碼: ${Array.from(type).map(c => c.charCodeAt(0)).join(',')})`);
                }
              });
            } else {
              logger.info(`✅ 成功找到 ${contextData.yearlyReports.length} 家匹配的供應商`);
              // 顯示前5個匹配的供應商
              contextData.yearlyReports.slice(0, 5).forEach(r => {
                logger.info(`   - ${r.vendorName}: ${r.nextYearAuditType}`);
              });
            }
            
            // 稽核類型查詢按供應商名稱排序
            contextData.yearlyReports.sort((a, b) => a.vendorName.localeCompare(b.vendorName, 'zh-TW'));
          } else if (parsedInfo.auditTypes && parsedInfo.auditTypes.length > 0) {
            // 如果指定了多種稽核類型，只篩選這些類型
            logger.debug(`🔍 開始篩選多種稽核類型: ${JSON.stringify(parsedInfo.auditTypes)}, 篩選前數量=${contextData.yearlyReports.length}`);
            
            // 保存統計信息到 contextData
            contextData._auditTypeStats = {
              beforeCount: contextData.yearlyReports.length,
              requestedTypes: parsedInfo.auditTypes,
              availableTypes: auditTypeCounts
            };
            
            const beforeCount = contextData.yearlyReports.length;
            contextData.yearlyReports = contextData.yearlyReports.filter(r => {
              // 檢查是否匹配任何一種請求的類型
              return parsedInfo.auditTypes.includes(r.nextYearAuditType);
            });
            
            logger.info(`✅ 篩選後數量=${contextData.yearlyReports.length} (從 ${beforeCount} 筆中篩選)`);
            logger.info(`   請求的類型: ${JSON.stringify(parsedInfo.auditTypes)}`);
            logger.info(`   各類型數量:`, auditTypeCounts);
            
            // 稽核類型查詢按供應商名稱排序
            contextData.yearlyReports.sort((a, b) => a.vendorName.localeCompare(b.vendorName, 'zh-TW'));
          } else {
            // 沒有指定具體類型，保留所有數據（用於顯示所有類型）
            logger.debug(`🔍 稽核類型查詢：未指定具體類型，保留所有數據（共${contextData.yearlyReports.length}筆）`);
            // 保存統計信息到 contextData
            contextData._auditTypeStats = {
              beforeCount: contextData.yearlyReports.length,
              requestedTypes: null,
              availableTypes: auditTypeCounts
            };
            // 按供應商名稱排序
            contextData.yearlyReports.sort((a, b) => a.vendorName.localeCompare(b.vendorName, 'zh-TW'));
          }
        } else {
          // 按年度分數降序排序（用於排名查詢）
          contextData.yearlyReports.sort((a, b) => {
            if (a.annualScore === null && b.annualScore === null) return 0;
            if (a.annualScore === null) return 1;
            if (b.annualScore === null) return -1;
            return b.annualScore - a.annualScore;
          });
        }
      }

      // 嘗試從問題中提取供應商名稱（智能模糊匹配）
      const allVendors = await prisma.sQMVQMVendor.findMany({
        orderBy: { name: 'asc' }
      });
      
      // 從問題中提取可能的供應商名稱（去除常見詞彙）
      const questionWords = question
        .replace(/[年月日]/g, ' ')
        .replace(/\d+/g, ' ')
        .split(/[\s，,。.、]/)
        .filter(word => word.length >= 2 && !['評核', '評鑑', '數據', '查詢', '顯示', '的', '是', '有', '哪些', '趨勢', '如何', '變化', '走勢'].includes(word))
        .map(word => word.trim());
      
      logger.debug('🔍 提取的關鍵詞:', questionWords);
      
      // 嘗試匹配供應商名稱
      let matchedVendor = null;
      for (const word of questionWords) {
        matchedVendor = findMatchingVendor(word, allVendors);
        if (matchedVendor) {
          logger.info('✅ 匹配到供應商:', matchedVendor.name, '（關鍵詞:', word, '）');
          break;
        }
      }
      
      if (!matchedVendor) {
        logger.warn('❌ 未找到匹配的供應商，嘗試的關鍵詞:', questionWords);
      }

      // 排名查詢且指定單一年+月：查詢該月所有供應商月報，依考核得分排序（例：2025年1月份的考核得分排名）
      if (parsedInfo.queryType === 'ranking' && parsedInfo.year != null && parsedInfo.month != null) {
        const y = parsedInfo.year;
        const m = parsedInfo.month;
        const monthReports = await prisma.sQMVQMMonthlyReport.findMany({
          where: { year: y, month: m },
          include: { vendor: true },
          orderBy: { vendor: { name: 'asc' } }
        });
        if (monthReports.length > 0) {
          const sorted = monthReports
            .map(r => ({
              vendorName: r.vendor.name,
              year: r.year,
              month: r.month,
              考核得分: r.assessmentScore,
              考核分數: r.assessmentScore,
              assessmentScore: r.assessmentScore,
              總品質評分: r.qualityAssessmentScoreC1,
              totalQualityScore: r.qualityAssessmentScoreC1,
              qualityAssessmentScoreC1: r.qualityAssessmentScoreC1,
              qualityAssessmentScoreC: r.qualityAssessmentScoreC1,
              交期評分: r.totalPurchaseAssessmentScoreA,
              deliveryScore: r.totalPurchaseAssessmentScoreA,
              totalPurchaseAssessmentScoreA: r.totalPurchaseAssessmentScoreA,
              服務評分: (r.serviceQuality || 0) + (r.servicePurchase || 0),
              totalServiceScore: (r.serviceQuality || 0) + (r.servicePurchase || 0),
              serviceQuality: r.serviceQuality,
              servicePurchase: r.servicePurchase,
              arr: r.arr,
              lrr: r.lrr,
              externalCAR: r.externalCAR,
              remarks: r.remarks
            }))
            .sort((a, b) => {
              const sa = a.assessmentScore != null ? a.assessmentScore : -1;
              const sb = b.assessmentScore != null ? b.assessmentScore : -1;
              return sb - sa;
            });
          contextData.monthlyReports = sorted;
          logger.debug(`🔍 ${y}年${m}月考核得分排名：共${sorted.length}家供應商`);
        }
      }

      // 如果需要查詢所有供應商（例如："哪一家變化最大"）
      if (parsedInfo.queryType !== 'ranking') {
        logger.debug('🔍 檢查是否需要查詢所有供應商:', {
          needAllVendors: parsedInfo.needAllVendors,
          startYear: parsedInfo.startYear,
          startMonth: parsedInfo.startMonth,
          endYear: parsedInfo.endYear,
          endMonth: parsedInfo.endMonth,
          hasMatchedVendor: !!matchedVendor,
          isRankingQuery: parsedInfo.queryType === 'ranking'
        });
        
        if (parsedInfo.needAllVendors && parsedInfo.startYear && parsedInfo.startMonth && parsedInfo.endYear && parsedInfo.endMonth) {
        logger.debug('🔍 查詢所有供應商的數據進行比較');
        const startSeq = parsedInfo.startYear * 12 + parsedInfo.startMonth;
        const endSeq = parsedInfo.endYear * 12 + parsedInfo.endMonth;
        
        // 查詢所有供應商在指定範圍內的數據（使用更簡單的查詢條件）
        const allVendorsReports = await prisma.sQMVQMMonthlyReport.findMany({
          include: { vendor: true },
          orderBy: [{ vendor: { name: 'asc' } }, { year: 'asc' }, { month: 'asc' }]
        });
        
        logger.debug('📊 查詢到所有供應商的原始報告數量:', allVendorsReports.length);
        
        // 過濾出範圍內的數據
        const filteredReports = allVendorsReports.filter(r => {
          const reportSeq = r.year * 12 + r.month;
          return reportSeq >= startSeq && reportSeq <= endSeq;
        });
        
        logger.debug('📊 過濾後範圍內的報告數量:', filteredReports.length);
        logger.debug('📊 日期範圍:', {
          start: `${parsedInfo.startYear}年${parsedInfo.startMonth}月 (序號: ${startSeq})`,
          end: `${parsedInfo.endYear}年${parsedInfo.endMonth}月 (序號: ${endSeq})`
        });
        
        // 按供應商分組並計算變化
        const vendorDataMap = {};
        filteredReports.forEach(r => {
          const vendorName = r.vendor.name;
          if (!vendorDataMap[vendorName]) {
            vendorDataMap[vendorName] = [];
          }
          vendorDataMap[vendorName].push({
            vendorName: vendorName,
            year: r.year,
            month: r.month,
            考核得分: r.assessmentScore,
            考核分數: r.assessmentScore,
            assessmentScore: r.assessmentScore,
            總品質評分: r.qualityAssessmentScoreC1,
            totalQualityScore: r.qualityAssessmentScoreC1,
            qualityAssessmentScoreC1: r.qualityAssessmentScoreC1,
            qualityAssessmentScoreC: r.qualityAssessmentScoreC1,
            交期評分: r.totalPurchaseAssessmentScoreA,
            deliveryScore: r.totalPurchaseAssessmentScoreA,
            totalPurchaseAssessmentScoreA: r.totalPurchaseAssessmentScoreA,
            服務評分: (r.serviceQuality || 0) + (r.servicePurchase || 0),
            totalServiceScore: (r.serviceQuality || 0) + (r.servicePurchase || 0),
            serviceQuality: r.serviceQuality, // 品質單位提供的服務評分（5分）
            servicePurchase: r.servicePurchase, // 採購單位提供的服務評分（5分）
            arr: r.arr,
            lrr: r.lrr,
            externalCAR: r.externalCAR,
            receivedBatches: r.receivedBatches,
            returnedBatches: r.returnedBatches,
            lateDelivery: r.lateDelivery,
            specialApproval: r.specialApproval,
            productionLineStop: r.productionLineStop,
            excessFreight: r.excessFreight,
            remarks: r.remarks
          });
        });
        
        // 計算每個供應商的變化
        const vendorChanges = [];
        Object.keys(vendorDataMap).forEach(vendorName => {
          const reports = vendorDataMap[vendorName].sort((a, b) => {
            const seqA = a.year * 12 + a.month;
            const seqB = b.year * 12 + b.month;
            return seqA - seqB;
          });
          
          if (reports.length >= 2) {
            const firstScore = reports[0].assessmentScore;
            const lastScore = reports[reports.length - 1].assessmentScore;
            if (firstScore !== null && lastScore !== null) {
              const change = Math.abs(lastScore - firstScore);
              vendorChanges.push({
                vendorName: vendorName,
                firstScore: firstScore,
                lastScore: lastScore,
                change: change,
                changeDirection: lastScore > firstScore ? '上升' : '下降',
                reports: reports
              });
            }
          }
        });
        
        // 按變化大小排序
        vendorChanges.sort((a, b) => b.change - a.change);
        
        // 將所有數據添加到 contextData
        contextData.monthlyReports = filteredReports.map(r => ({
          vendorName: r.vendor.name,
          year: r.year,
          month: r.month,
          考核得分: r.assessmentScore,
          考核分數: r.assessmentScore,
          assessmentScore: r.assessmentScore,
          總品質評分: r.qualityAssessmentScoreC1,
          totalQualityScore: r.qualityAssessmentScoreC1,
          qualityAssessmentScoreC1: r.qualityAssessmentScoreC1,
          qualityAssessmentScoreC: r.qualityAssessmentScoreC1,
            交期評分: r.totalPurchaseAssessmentScoreA,
            deliveryScore: r.totalPurchaseAssessmentScoreA,
            totalPurchaseAssessmentScoreA: r.totalPurchaseAssessmentScoreA,
            // 服務評分（總分10分 = serviceQuality + servicePurchase）
            服務評分: (r.serviceQuality || 0) + (r.servicePurchase || 0),
            totalServiceScore: (r.serviceQuality || 0) + (r.servicePurchase || 0),
            serviceQuality: r.serviceQuality, // 品質單位提供的服務評分（5分）
            servicePurchase: r.servicePurchase, // 採購單位提供的服務評分（5分）
          arr: r.arr,
          lrr: r.lrr,
          externalCAR: r.externalCAR,
          receivedBatches: r.receivedBatches,
          returnedBatches: r.returnedBatches,
          lateDelivery: r.lateDelivery,
          specialApproval: r.specialApproval,
          productionLineStop: r.productionLineStop,
          excessFreight: r.excessFreight,
          remarks: r.remarks
        }));
        
        // 添加比較統計數據
        contextData.statistics = {
          vendorChanges: vendorChanges,
          totalVendors: vendorChanges.length,
          maxChange: vendorChanges.length > 0 ? vendorChanges[0] : null
        };
      }
      } // 關閉 if (parsedInfo.queryType !== 'ranking') 塊
      
      // 如果匹配到供應商，查詢該供應商的數據
      if (matchedVendor && !parsedInfo.needAllVendors) {
        // 構建查詢條件
        let whereCondition = { vendorId: matchedVendor.id };
        
        // 如果有日期範圍，查詢指定範圍的數據
        if (parsedInfo.startYear && parsedInfo.startMonth && parsedInfo.endYear && parsedInfo.endMonth) {
          // 計算開始和結束的日期序號（year * 12 + month）
          const startSeq = parsedInfo.startYear * 12 + parsedInfo.startMonth;
          const endSeq = parsedInfo.endYear * 12 + parsedInfo.endMonth;
          
          logger.debug('📅 查詢日期範圍:', {
            start: `${parsedInfo.startYear}年${parsedInfo.startMonth}月`,
            end: `${parsedInfo.endYear}年${parsedInfo.endMonth}月`,
            startSeq,
            endSeq
          });
          
          // 查詢範圍內的數據
          const allReports = await prisma.sQMVQMMonthlyReport.findMany({
            where: { vendorId: matchedVendor.id },
            orderBy: [{ year: 'asc' }, { month: 'asc' }]
          });
          
          logger.debug('📊 供應商所有報告數量:', allReports.length);
          
          const vendorMonthlyReports = allReports.filter(r => {
            const reportSeq = r.year * 12 + r.month;
            return reportSeq >= startSeq && reportSeq <= endSeq;
          });
          
          logger.debug('📊 範圍內報告數量:', vendorMonthlyReports.length);
          
          contextData.monthlyReports = vendorMonthlyReports.map(r => ({
            vendorName: matchedVendor.name,
            year: r.year,
            month: r.month,
            // 品質相關
            總品質評分: r.qualityAssessmentScoreC1,
            totalQualityScore: r.qualityAssessmentScoreC1,
            qualityAssessmentScoreC: r.qualityAssessmentScoreC1,
            qualityAssessmentScoreC1: r.qualityAssessmentScoreC1,
            totalBaseScoreB: r.totalBaseScoreB,
            serviceQuality: r.serviceQuality, // 品質單位提供的服務評分（5分）
            // 採購相關
            交期評分: r.totalPurchaseAssessmentScoreA,
            deliveryScore: r.totalPurchaseAssessmentScoreA,
            totalPurchaseAssessmentScoreA: r.totalPurchaseAssessmentScoreA,
            purchaseAssessmentScoreA: r.purchaseAssessmentScoreA,
            servicePurchase: r.servicePurchase, // 採購單位提供的服務評分（5分）
            // 服務評分（總分10分 = serviceQuality + servicePurchase）
            服務評分: (r.serviceQuality || 0) + (r.servicePurchase || 0),
            totalServiceScore: (r.serviceQuality || 0) + (r.servicePurchase || 0),
            // 綜合（支持兩種說法）
            考核得分: r.assessmentScore,
            考核分數: r.assessmentScore,
            assessmentScore: r.assessmentScore,
            // 其他字段（添加中文映射）
            產線: r.arr,
            產線CCR: r.arr,
            產線件數: r.arr,
            arr: r.arr,
            IQC: r.lrr,
            IQC_CCR: r.lrr,
            IQC件數: r.lrr,
            lrr: r.lrr,
            客訴: r.externalCAR,
            客訴CCR: r.externalCAR,
            客訴件數: r.externalCAR,
            外部CAR: r.externalCAR,
            externalCAR: r.externalCAR,
            未準時回覆: r.untimelyResponseCCR,
            未準時回覆CCR: r.untimelyResponseCCR,
            untimelyResponseCCR: r.untimelyResponseCCR,
            其他: r.others,
            其他評分: r.others,
            others: r.others,
            品質基數評分: r.totalBaseScoreB,
            基礎評分: r.totalBaseScoreB,
            totalBaseScoreB: r.totalBaseScoreB,
            品質鑑定總分: r.qualityAssessmentScoreC1,
            A加B總分: r.qualityAssessmentScoreC1,
            qualityAssessmentScoreC1: r.qualityAssessmentScoreC1,
            進貨批數: r.receivedBatches,
            receivedBatches: r.receivedBatches,
            退貨批數: r.returnedBatches,
            returnedBatches: r.returnedBatches,
            進貨量: r.receivedQuantity,
            接收數量: r.receivedQuantity,
            receivedQuantity: r.receivedQuantity,
            退貨量: r.returnedQuantity,
            退回數量: r.returnedQuantity,
            returnedQuantity: r.returnedQuantity,
            遲交: r.lateDelivery,
            遲交次數: r.lateDelivery,
            lateDelivery: r.lateDelivery,
            特採: r.specialApproval,
            特採次數: r.specialApproval,
            specialApproval: r.specialApproval,
            造成斷線: r.productionLineStop,
            斷線次數: r.productionLineStop,
            productionLineStop: r.productionLineStop,
            超額運費: r.excessFreight,
            產生超額運費: r.excessFreight,
            excessFreight: r.excessFreight,
            採購鑑定總分: r.purchaseAssessmentScoreA,
            採購評分A: r.purchaseAssessmentScoreA,
            purchaseAssessmentScoreA: r.purchaseAssessmentScoreA,
            備註: r.remarks,
            說明: r.remarks,
            remarks: r.remarks
          }));
        } else {
          // 如果有單個年份和月份，添加過濾條件
          if (parsedInfo.year && parsedInfo.month) {
            whereCondition.year = parsedInfo.year;
            whereCondition.month = parsedInfo.month;
            logger.debug(`📅 查詢單個月份: ${parsedInfo.year}年${parsedInfo.month}月`);
          } else if (parsedInfo.year) {
            // 如果只有年份，只過濾年份
            whereCondition.year = parsedInfo.year;
            logger.debug(`📅 查詢年份: ${parsedInfo.year}年`);
          }
          
          // 查詢該供應商的所有月評核數據（包含更多字段）
          const vendorMonthlyReports = await prisma.sQMVQMMonthlyReport.findMany({
            where: whereCondition,
            orderBy: [{ year: 'asc' }, { month: 'asc' }], // 改為升序，便於趨勢分析
            take: 24 // 增加查詢數量，支持更長時間範圍的趨勢分析
          });
          
          logger.debug(`📊 查詢到的月評核數據數量: ${vendorMonthlyReports.length}`);
          
          contextData.monthlyReports = vendorMonthlyReports.map(r => ({
            vendorName: matchedVendor.name,
            year: r.year,
            month: r.month,
            // 品質相關
            總品質評分: r.qualityAssessmentScoreC1,
            totalQualityScore: r.qualityAssessmentScoreC1,
            qualityAssessmentScoreC: r.qualityAssessmentScoreC1,
            qualityAssessmentScoreC1: r.qualityAssessmentScoreC1,
            totalBaseScoreB: r.totalBaseScoreB,
            serviceQuality: r.serviceQuality, // 品質單位提供的服務評分（5分）
            // 採購相關
            交期評分: r.totalPurchaseAssessmentScoreA,
            deliveryScore: r.totalPurchaseAssessmentScoreA,
            totalPurchaseAssessmentScoreA: r.totalPurchaseAssessmentScoreA,
            purchaseAssessmentScoreA: r.purchaseAssessmentScoreA,
            servicePurchase: r.servicePurchase, // 採購單位提供的服務評分（5分）
            // 服務評分（總分10分 = serviceQuality + servicePurchase）
            服務評分: (r.serviceQuality || 0) + (r.servicePurchase || 0),
            totalServiceScore: (r.serviceQuality || 0) + (r.servicePurchase || 0),
            // 綜合（支持兩種說法）
            考核得分: r.assessmentScore,
            考核分數: r.assessmentScore,
            assessmentScore: r.assessmentScore,
            // 其他字段（添加中文映射）
            產線: r.arr,
            產線CCR: r.arr,
            產線件數: r.arr,
            arr: r.arr,
            IQC: r.lrr,
            IQC_CCR: r.lrr,
            IQC件數: r.lrr,
            lrr: r.lrr,
            客訴: r.externalCAR,
            客訴CCR: r.externalCAR,
            客訴件數: r.externalCAR,
            外部CAR: r.externalCAR,
            externalCAR: r.externalCAR,
            未準時回覆: r.untimelyResponseCCR,
            未準時回覆CCR: r.untimelyResponseCCR,
            untimelyResponseCCR: r.untimelyResponseCCR,
            其他: r.others,
            其他評分: r.others,
            others: r.others,
            品質基數評分: r.totalBaseScoreB,
            基礎評分: r.totalBaseScoreB,
            totalBaseScoreB: r.totalBaseScoreB,
            品質鑑定總分: r.qualityAssessmentScoreC1,
            A加B總分: r.qualityAssessmentScoreC1,
            qualityAssessmentScoreC1: r.qualityAssessmentScoreC1,
            進貨批數: r.receivedBatches,
            receivedBatches: r.receivedBatches,
            退貨批數: r.returnedBatches,
            returnedBatches: r.returnedBatches,
            進貨量: r.receivedQuantity,
            接收數量: r.receivedQuantity,
            receivedQuantity: r.receivedQuantity,
            退貨量: r.returnedQuantity,
            退回數量: r.returnedQuantity,
            returnedQuantity: r.returnedQuantity,
            遲交: r.lateDelivery,
            遲交次數: r.lateDelivery,
            lateDelivery: r.lateDelivery,
            特採: r.specialApproval,
            特採次數: r.specialApproval,
            specialApproval: r.specialApproval,
            造成斷線: r.productionLineStop,
            斷線次數: r.productionLineStop,
            productionLineStop: r.productionLineStop,
            超額運費: r.excessFreight,
            產生超額運費: r.excessFreight,
            excessFreight: r.excessFreight,
            採購鑑定總分: r.purchaseAssessmentScoreA,
            採購評分A: r.purchaseAssessmentScoreA,
            purchaseAssessmentScoreA: r.purchaseAssessmentScoreA,
            備註: r.remarks,
            說明: r.remarks,
            remarks: r.remarks
          }));
        }
        
        // 如果有指定年份和月份，也查詢該供應商的年度數據
        if (parsedInfo.year) {
          const vendorYearlyReport = await prisma.sQMVQMAnnualInput.findFirst({
            where: {
              vendorId: matchedVendor.id,
              year: parsedInfo.year
            }
          });
          if (vendorYearlyReport) {
            contextData.yearlyReports = [{
              vendorName: matchedVendor.name,
              year: vendorYearlyReport.year,
              VDA: vendorYearlyReport.VDA,
              QSA: vendorYearlyReport.QSA,
              QPA: vendorYearlyReport.QPA,
              HSF: vendorYearlyReport.HSF,
              CSR: vendorYearlyReport.CSR,
              nextYearAuditType: vendorYearlyReport.nextYearAuditType,
              remarks: vendorYearlyReport.remarks
            }];
          }
        }
      }
    } else if (systemType === 'osat') {
      // 查詢 OSAT 供應商列表
      // 查詢 OSAT 供應商列表（查詢所有供應商，不限制數量）
      const vendors = await prisma.oSATVendor.findMany({
        orderBy: { name: 'asc' }
      });
      contextData.vendors = vendors.map(v => ({ name: v.name }));

      // 如果有指定年份和月份，查詢月評核數據
      if (parsedInfo.year && parsedInfo.month) {
        const monthlyReports = await prisma.oSATMonthlyReport.findMany({
          where: {
            year: parsedInfo.year,
            month: parsedInfo.month
          },
          include: { vendor: true },
          orderBy: { vendor: { name: 'asc' } }
        });
        contextData.monthlyReports = monthlyReports.map(r => ({
          vendorName: r.vendor.name,
          factory: r.factory,
          year: r.year,
          month: r.month,
          // 品質相關（使用UI友好名稱）
          總品質評分: r.qualityAssessmentScoreWeighted || r.qualityAssessmentScore,
          totalQualityScore: r.qualityAssessmentScoreWeighted || r.qualityAssessmentScore,
          qualityAssessmentScore: r.qualityAssessmentScore,
          qualityAssessmentScoreWeighted: r.qualityAssessmentScoreWeighted,
          totalBaseScoreB: r.totalBaseScoreB,
          serviceQuality: r.serviceQuality,
          // 採購相關（使用UI友好名稱）
          交期評分: r.totalPurchaseAssessmentScoreA,
          deliveryScore: r.totalPurchaseAssessmentScoreA,
          totalPurchaseAssessmentScoreA: r.totalPurchaseAssessmentScoreA,
          purchaseAssessmentScoreA: r.purchaseAssessmentScoreA,
          servicePurchase: r.servicePurchase,
          // 綜合（使用UI友好名稱，支持兩種說法）
          考核得分: r.assessmentScore,
          考核分數: r.assessmentScore, // 支持"考核分數"和"考核得分"兩種說法
          assessmentScore: r.assessmentScore,
          // 其他字段（添加中文映射）
          廠區: r.factory,
          工廠: r.factory,
          岡山: r.factory === 'gangshan' ? 'gangshan' : null,
          蘇州: r.factory === 'suzhou' ? 'suzhou' : null,
          factory: r.factory,
          出貨量: r.shipmentQuantity,
          出貨量K: r.shipmentQuantity,
          shipmentQuantity: r.shipmentQuantity,
          進貨批數: r.receivedBatches,
          receivedBatches: r.receivedBatches,
          退貨批數: r.returnedBatches,
          returnedBatches: r.returnedBatches,
          客訴總件數: r.totalComplaintCCR,
          總客訴: r.totalComplaintCCR,
          客訴總數: r.totalComplaintCCR,
          totalComplaintCCR: r.totalComplaintCCR,
          嚴重客訴: r.severeComplaintCCR,
          嚴重客訴CCR: r.severeComplaintCCR,
          severeComplaintCCR: r.severeComplaintCCR,
          一般客訴: r.generalComplaintCCR,
          一般客訴CCR: r.generalComplaintCCR,
          generalComplaintCCR: r.generalComplaintCCR,
          客訴再發: r.complaintRecurrenceCCR,
          客訴再發CCR: r.complaintRecurrenceCCR,
          complaintRecurrenceCCR: r.complaintRecurrenceCCR,
          集團CAR: r.groupCAR,
          CAR件數: r.groupCAR,
          groupCAR: r.groupCAR,
          準時回覆: r.timelyResponseCCR,
          準時回覆CCR: r.timelyResponseCCR,
          timelyResponseCCR: r.timelyResponseCCR,
          未準時回覆: r.untimelyResponseCCR,
          未準時回覆CCR: r.untimelyResponseCCR,
          untimelyResponseCCR: r.untimelyResponseCCR,
          進料允收率評分A1: r.incomingAcceptanceScoreA1,
          A1評分: r.incomingAcceptanceScoreA1,
          incomingAcceptanceScoreA1: r.incomingAcceptanceScoreA1,
          進料允收率評分A: r.incomingAcceptanceScoreA,
          總分A: r.incomingAcceptanceScoreA,
          incomingAcceptanceScoreA: r.incomingAcceptanceScoreA,
          基礎評分B1: r.baseScoreB1,
          B1評分: r.baseScoreB1,
          baseScoreB1: r.baseScoreB1,
          基礎評分B2: r.baseScoreB2,
          B2評分: r.baseScoreB2,
          baseScoreB2: r.baseScoreB2,
          基礎評分總分B: r.totalBaseScoreB,
          總分B: r.totalBaseScoreB,
          totalBaseScoreB: r.totalBaseScoreB,
          其他: r.others,
          其他評分: r.others,
          others: r.others,
          品質鑑定分數: r.qualityAssessmentScore,
          品質評分: r.qualityAssessmentScore,
          qualityAssessmentScore: r.qualityAssessmentScore,
          遲交: r.lateDelivery,
          遲交次數: r.lateDelivery,
          lateDelivery: r.lateDelivery,
          特採: r.specialApproval,
          特採次數: r.specialApproval,
          specialApproval: r.specialApproval,
          造成斷線: r.productionLineStop,
          斷線次數: r.productionLineStop,
          productionLineStop: r.productionLineStop,
          超額運費: r.excessFreight,
          產生超額運費: r.excessFreight,
          excessFreight: r.excessFreight,
          採購鑑定總分: r.purchaseAssessmentScoreA,
          採購評分A: r.purchaseAssessmentScoreA,
          purchaseAssessmentScoreA: r.purchaseAssessmentScoreA,
          備註: r.remarks,
          說明: r.remarks,
          remarks: r.remarks
        }));
        if (parsedInfo.queryType === 'ranking' && contextData.monthlyReports.length > 0) {
          contextData.monthlyReports.sort((a, b) => (b.assessmentScore ?? -1) - (a.assessmentScore ?? -1));
        }
      }

      // 如果有指定年份，查詢年度評核數據（包含計算字段）
      // 重要：需要查詢所有有月評核數據的供應商，而不僅僅是有年度輸入數據的供應商
      if (parsedInfo.year && !parsedInfo.month) {
        // 查詢該年份的所有月評核數據，用於計算年度分數
        const allMonthlyReportsForYear = await prisma.oSATMonthlyReport.findMany({
          where: { year: parsedInfo.year },
          include: { vendor: true },
          orderBy: [{ vendorId: 'asc' }, { month: 'asc' }]
        });
        
        // 查詢該年份的所有年度輸入數據
        const allAnnualInputs = await prisma.oSATAnnualInput.findMany({
          where: { year: parsedInfo.year },
          include: { vendor: true }
        });
        
        // 建立年度輸入數據的索引（按vendorId）
        const annualInputsByVendor = {};
        allAnnualInputs.forEach(input => {
          annualInputsByVendor[input.vendorId] = input;
        });
        
        // 按供應商分組月評核數據
        const monthlyReportsByVendor = {};
        const vendorsWithMonthlyData = new Set();
        allMonthlyReportsForYear.forEach(report => {
          if (!monthlyReportsByVendor[report.vendorId]) {
            monthlyReportsByVendor[report.vendorId] = [];
            vendorsWithMonthlyData.add(report.vendorId);
          }
          monthlyReportsByVendor[report.vendorId].push(report);
        });
        
        // 為所有有月評核數據的供應商計算年度分數
        contextData.yearlyReports = [];
        for (const vendorId of vendorsWithMonthlyData) {
          const monthlyReports = monthlyReportsByVendor[vendorId];
          const vendor = monthlyReports[0].vendor;
          const annualInput = annualInputsByVendor[vendorId] || null;
          
          // 計算該供應商的月考核平均分數
          const assessmentScores = monthlyReports
            .map(report => report.assessmentScore)
            .filter(score => score !== null && score !== undefined);
          
          const monthlyAssessmentSummary = assessmentScores.length > 0
            ? roundTo3Decimals(assessmentScores.reduce((a, b) => a + b, 0) / assessmentScores.length)
            : null;
          
          // 計算年度分數
          const auditComponent = annualInput ? getAuditComponent(annualInput) : 0;
          const others = annualInput?.others ?? 0;
          const annualScore = monthlyAssessmentSummary !== null
            ? (() => {
                // 如果沒有年度稽核分數，只根據月考核分數計算（不扣分）
                if (auditComponent === 0) {
                  return roundTo3Decimals(monthlyAssessmentSummary - others);
                }
                return roundTo3Decimals((monthlyAssessmentSummary * 0.9) + (auditComponent * 0.1) - others);
              })()
            : null;
          
          // 計算等級
          const grade = annualScore !== null ? (() => {
            if (annualScore >= 95) return 'A';
            if (annualScore >= 85) return 'B';
            if (annualScore >= 75) return 'C';
            if (annualScore >= 60) return 'D';
            return 'E';
          })() : null;
          
          contextData.yearlyReports.push({
            vendorName: vendor.name,
            year: parsedInfo.year,
            VDA: annualInput?.VDA ?? null,
            QSA: annualInput?.QSA ?? null,
            QPA: annualInput?.QPA ?? null,
            HSF: annualInput?.HSF ?? null,
            CSR: annualInput?.CSR ?? null,
            others: annualInput?.others ?? null,
            nextYearAuditType: annualInput?.nextYearAuditType ?? null,
            remarks: annualInput?.remarks ?? null,
            // 計算字段
            月考核平均: monthlyAssessmentSummary,
            monthlyAssessmentSummary: monthlyAssessmentSummary,
            年度分數: annualScore,
            annualScore: annualScore,
            等級: grade,
            grade: grade
          });
        }
        
        // 按年度分數降序排序（用於排名查詢）
        contextData.yearlyReports.sort((a, b) => {
          if (a.annualScore === null && b.annualScore === null) return 0;
          if (a.annualScore === null) return 1;
          if (b.annualScore === null) return -1;
          return b.annualScore - a.annualScore;
        });

        // 若為「依客訴總件數排序」、排名查詢、或「統計」客訴／異常，依該年度月報加總客訴並排序，供 AI 回答
        const isComplaintRanking = (question.includes('客訴') || question.includes('總件數') || question.includes('異常')) &&
          ((parsedInfo.queryType === 'ranking' || question.includes('排序') || question.includes('排名')) ||
           (question.includes('統計') && (question.includes('柏拉圖') || question.includes('異常') || question.includes('客訴'))));
        if (isComplaintRanking && monthlyReportsByVendor && Object.keys(monthlyReportsByVendor).length > 0) {
          const complaintList = [];
          for (const vendorId of vendorsWithMonthlyData) {
            const reports = monthlyReportsByVendor[vendorId];
            const vendorName = reports[0].vendor.name;
            let totalComplaintCCR = 0, severeComplaintCCR = 0, generalComplaintCCR = 0, complaintRecurrenceCCR = 0, groupCAR = 0;
            const remarkPieces = [];
            reports.forEach(r => {
              totalComplaintCCR += Number(r.totalComplaintCCR ?? 0);
              severeComplaintCCR += Number(r.severeComplaintCCR ?? 0);
              generalComplaintCCR += Number(r.generalComplaintCCR ?? 0);
              complaintRecurrenceCCR += Number(r.complaintRecurrenceCCR ?? 0);
              groupCAR += Number(r.groupCAR ?? 0);
              if (r.remarks && String(r.remarks).trim()) {
                remarkPieces.push(String(r.remarks).trim());
              }
            });
            let remarkSummary = '';
            if (remarkPieces.length > 0) {
              const joined = remarkPieces.join(' / ');
              remarkSummary = joined.length > 300 ? `${joined.slice(0, 300)}…` : joined;
            }
            complaintList.push({
              vendorName,
              totalComplaintCCR,
              severeComplaintCCR,
              generalComplaintCCR,
              complaintRecurrenceCCR,
              groupCAR,
              remarkSummary
            });
          }
          complaintList.sort((a, b) => b.totalComplaintCCR - a.totalComplaintCCR);
          contextData.osatVendorComplaintRanking = { year: parsedInfo.year, list: complaintList };
          logger.info(`✅ OSAT ${parsedInfo.year}年依客訴總件數排序：${complaintList.length} 家供應商`);
        }
      }

      // 嘗試從問題中提取供應商名稱（智能模糊匹配）- OSAT系統
      const allVendorsOSAT = await prisma.oSATVendor.findMany({
        orderBy: { name: 'asc' }
      });
      
      // 從問題中提取可能的供應商名稱（去除常見詞彙）
      const questionWordsOSAT = question
        .replace(/[年月日]/g, ' ')
        .replace(/\d+/g, ' ')
        .split(/[\s，,。.、]/)
        .filter(word => word.length >= 2 && !['評核', '評鑑', '數據', '查詢', '顯示', '的', '是', '有', '哪些', '趨勢', '如何', '變化', '走勢'].includes(word))
        .map(word => word.trim());
      
      logger.debug('🔍 OSAT 提取的關鍵詞:', questionWordsOSAT);
      
      // 嘗試匹配供應商名稱
      let matchedVendorOSAT = null;
      for (const word of questionWordsOSAT) {
        matchedVendorOSAT = findMatchingVendor(word, allVendorsOSAT);
        if (matchedVendorOSAT) {
          logger.info('✅ OSAT 匹配到供應商:', matchedVendorOSAT.name, '（關鍵詞:', word, '）');
          break;
        }
      }
      
      if (matchedVendorOSAT) {
        // 構建查詢條件
        let whereConditionOSAT = { vendorId: matchedVendorOSAT.id };
        
        // 如果有日期範圍，查詢指定範圍的數據
        if (parsedInfo.startYear && parsedInfo.startMonth && parsedInfo.endYear && parsedInfo.endMonth) {
          // 計算開始和結束的日期序號（year * 12 + month）
          const startSeq = parsedInfo.startYear * 12 + parsedInfo.startMonth;
          const endSeq = parsedInfo.endYear * 12 + parsedInfo.endMonth;
          
          logger.debug('📅 OSAT 查詢日期範圍:', {
            start: `${parsedInfo.startYear}年${parsedInfo.startMonth}月`,
            end: `${parsedInfo.endYear}年${parsedInfo.endMonth}月`,
            startSeq,
            endSeq
          });
          
          // 查詢範圍內的數據
          const allReportsOSAT = await prisma.oSATMonthlyReport.findMany({
            where: { vendorId: matchedVendorOSAT.id },
            orderBy: [{ year: 'asc' }, { month: 'asc' }]
          });
          
          logger.debug('📊 OSAT 供應商所有報告數量:', allReportsOSAT.length);
          
          const vendorMonthlyReportsOSAT = allReportsOSAT.filter(r => {
            const reportSeq = r.year * 12 + r.month;
            return reportSeq >= startSeq && reportSeq <= endSeq;
          });
          
          logger.debug('📊 OSAT 範圍內報告數量:', vendorMonthlyReportsOSAT.length);
          
          contextData.monthlyReports = vendorMonthlyReportsOSAT.map(r => ({
            vendorName: matchedVendorOSAT.name,
            factory: r.factory,
            year: r.year,
            month: r.month,
            // 品質相關（使用UI友好名稱）
            總品質評分: r.qualityAssessmentScoreWeighted || r.qualityAssessmentScore,
            totalQualityScore: r.qualityAssessmentScoreWeighted || r.qualityAssessmentScore,
            qualityAssessmentScore: r.qualityAssessmentScore,
            qualityAssessmentScoreWeighted: r.qualityAssessmentScoreWeighted,
            totalBaseScoreB: r.totalBaseScoreB,
            serviceQuality: r.serviceQuality,
            // 採購相關（使用UI友好名稱）
            交期評分: r.totalPurchaseAssessmentScoreA,
            deliveryScore: r.totalPurchaseAssessmentScoreA,
            totalPurchaseAssessmentScoreA: r.totalPurchaseAssessmentScoreA,
            purchaseAssessmentScoreA: r.purchaseAssessmentScoreA,
            servicePurchase: r.servicePurchase,
            // 綜合（使用UI友好名稱，支持兩種說法）
            考核得分: r.assessmentScore,
            考核分數: r.assessmentScore,
            assessmentScore: r.assessmentScore,
            // 其他字段（添加中文映射）
            廠區: r.factory,
            工廠: r.factory,
            岡山: r.factory === 'gangshan' ? 'gangshan' : null,
            蘇州: r.factory === 'suzhou' ? 'suzhou' : null,
            factory: r.factory,
            出貨量: r.shipmentQuantity,
            出貨量K: r.shipmentQuantity,
            shipmentQuantity: r.shipmentQuantity,
            進貨批數: r.receivedBatches,
            receivedBatches: r.receivedBatches,
            退貨批數: r.returnedBatches,
            returnedBatches: r.returnedBatches,
            客訴總件數: r.totalComplaintCCR,
            總客訴: r.totalComplaintCCR,
            客訴總數: r.totalComplaintCCR,
            totalComplaintCCR: r.totalComplaintCCR,
            嚴重客訴: r.severeComplaintCCR,
            嚴重客訴CCR: r.severeComplaintCCR,
            severeComplaintCCR: r.severeComplaintCCR,
            一般客訴: r.generalComplaintCCR,
            一般客訴CCR: r.generalComplaintCCR,
            generalComplaintCCR: r.generalComplaintCCR,
            客訴再發: r.complaintRecurrenceCCR,
            客訴再發CCR: r.complaintRecurrenceCCR,
            complaintRecurrenceCCR: r.complaintRecurrenceCCR,
            集團CAR: r.groupCAR,
            CAR件數: r.groupCAR,
            groupCAR: r.groupCAR,
            準時回覆: r.timelyResponseCCR,
            準時回覆CCR: r.timelyResponseCCR,
            timelyResponseCCR: r.timelyResponseCCR,
            未準時回覆: r.untimelyResponseCCR,
            未準時回覆CCR: r.untimelyResponseCCR,
            untimelyResponseCCR: r.untimelyResponseCCR,
            進料允收率評分A1: r.incomingAcceptanceScoreA1,
            A1評分: r.incomingAcceptanceScoreA1,
            incomingAcceptanceScoreA1: r.incomingAcceptanceScoreA1,
            進料允收率評分A: r.incomingAcceptanceScoreA,
            總分A: r.incomingAcceptanceScoreA,
            incomingAcceptanceScoreA: r.incomingAcceptanceScoreA,
            基礎評分B1: r.baseScoreB1,
            B1評分: r.baseScoreB1,
            baseScoreB1: r.baseScoreB1,
            基礎評分B2: r.baseScoreB2,
            B2評分: r.baseScoreB2,
            baseScoreB2: r.baseScoreB2,
            基礎評分總分B: r.totalBaseScoreB,
            總分B: r.totalBaseScoreB,
            totalBaseScoreB: r.totalBaseScoreB,
            其他: r.others,
            其他評分: r.others,
            others: r.others,
            品質鑑定分數: r.qualityAssessmentScore,
            品質評分: r.qualityAssessmentScore,
            qualityAssessmentScore: r.qualityAssessmentScore,
            遲交: r.lateDelivery,
            遲交次數: r.lateDelivery,
            lateDelivery: r.lateDelivery,
            特採: r.specialApproval,
            特採次數: r.specialApproval,
            specialApproval: r.specialApproval,
            造成斷線: r.productionLineStop,
            斷線次數: r.productionLineStop,
            productionLineStop: r.productionLineStop,
            超額運費: r.excessFreight,
            產生超額運費: r.excessFreight,
            excessFreight: r.excessFreight,
            採購鑑定總分: r.purchaseAssessmentScoreA,
            採購評分A: r.purchaseAssessmentScoreA,
            purchaseAssessmentScoreA: r.purchaseAssessmentScoreA,
            備註: r.remarks,
            說明: r.remarks,
            remarks: r.remarks
          }));
        } else {
          // 查詢該供應商的所有月評核數據（包含更多字段）
          const vendorMonthlyReportsOSAT = await prisma.oSATMonthlyReport.findMany({
            where: whereConditionOSAT,
            orderBy: [{ year: 'asc' }, { month: 'asc' }], // 改為升序，便於趨勢分析
            take: 24 // 增加查詢數量，支持更長時間範圍的趨勢分析
          });
          
          contextData.monthlyReports = vendorMonthlyReportsOSAT.map(r => ({
            vendorName: matchedVendorOSAT.name,
            factory: r.factory,
            year: r.year,
            month: r.month,
            // 品質相關（使用UI友好名稱）
            總品質評分: r.qualityAssessmentScoreWeighted || r.qualityAssessmentScore,
            totalQualityScore: r.qualityAssessmentScoreWeighted || r.qualityAssessmentScore,
            qualityAssessmentScore: r.qualityAssessmentScore,
            qualityAssessmentScoreWeighted: r.qualityAssessmentScoreWeighted,
            totalBaseScoreB: r.totalBaseScoreB,
            serviceQuality: r.serviceQuality,
            // 採購相關（使用UI友好名稱）
            交期評分: r.totalPurchaseAssessmentScoreA,
            deliveryScore: r.totalPurchaseAssessmentScoreA,
            totalPurchaseAssessmentScoreA: r.totalPurchaseAssessmentScoreA,
            purchaseAssessmentScoreA: r.purchaseAssessmentScoreA,
            servicePurchase: r.servicePurchase,
            // 綜合（使用UI友好名稱，支持兩種說法）
            考核得分: r.assessmentScore,
            考核分數: r.assessmentScore,
            assessmentScore: r.assessmentScore,
            // 其他字段（添加中文映射）
            廠區: r.factory,
            工廠: r.factory,
            岡山: r.factory === 'gangshan' ? 'gangshan' : null,
            蘇州: r.factory === 'suzhou' ? 'suzhou' : null,
            factory: r.factory,
            出貨量: r.shipmentQuantity,
            出貨量K: r.shipmentQuantity,
            shipmentQuantity: r.shipmentQuantity,
            進貨批數: r.receivedBatches,
            receivedBatches: r.receivedBatches,
            退貨批數: r.returnedBatches,
            returnedBatches: r.returnedBatches,
            客訴總件數: r.totalComplaintCCR,
            總客訴: r.totalComplaintCCR,
            客訴總數: r.totalComplaintCCR,
            totalComplaintCCR: r.totalComplaintCCR,
            嚴重客訴: r.severeComplaintCCR,
            嚴重客訴CCR: r.severeComplaintCCR,
            severeComplaintCCR: r.severeComplaintCCR,
            一般客訴: r.generalComplaintCCR,
            一般客訴CCR: r.generalComplaintCCR,
            generalComplaintCCR: r.generalComplaintCCR,
            客訴再發: r.complaintRecurrenceCCR,
            客訴再發CCR: r.complaintRecurrenceCCR,
            complaintRecurrenceCCR: r.complaintRecurrenceCCR,
            集團CAR: r.groupCAR,
            CAR件數: r.groupCAR,
            groupCAR: r.groupCAR,
            準時回覆: r.timelyResponseCCR,
            準時回覆CCR: r.timelyResponseCCR,
            timelyResponseCCR: r.timelyResponseCCR,
            未準時回覆: r.untimelyResponseCCR,
            未準時回覆CCR: r.untimelyResponseCCR,
            untimelyResponseCCR: r.untimelyResponseCCR,
            進料允收率評分A1: r.incomingAcceptanceScoreA1,
            A1評分: r.incomingAcceptanceScoreA1,
            incomingAcceptanceScoreA1: r.incomingAcceptanceScoreA1,
            進料允收率評分A: r.incomingAcceptanceScoreA,
            總分A: r.incomingAcceptanceScoreA,
            incomingAcceptanceScoreA: r.incomingAcceptanceScoreA,
            基礎評分B1: r.baseScoreB1,
            B1評分: r.baseScoreB1,
            baseScoreB1: r.baseScoreB1,
            基礎評分B2: r.baseScoreB2,
            B2評分: r.baseScoreB2,
            baseScoreB2: r.baseScoreB2,
            基礎評分總分B: r.totalBaseScoreB,
            總分B: r.totalBaseScoreB,
            totalBaseScoreB: r.totalBaseScoreB,
            其他: r.others,
            其他評分: r.others,
            others: r.others,
            品質鑑定分數: r.qualityAssessmentScore,
            品質評分: r.qualityAssessmentScore,
            qualityAssessmentScore: r.qualityAssessmentScore,
            遲交: r.lateDelivery,
            遲交次數: r.lateDelivery,
            lateDelivery: r.lateDelivery,
            特採: r.specialApproval,
            特採次數: r.specialApproval,
            specialApproval: r.specialApproval,
            造成斷線: r.productionLineStop,
            斷線次數: r.productionLineStop,
            productionLineStop: r.productionLineStop,
            超額運費: r.excessFreight,
            產生超額運費: r.excessFreight,
            excessFreight: r.excessFreight,
            採購鑑定總分: r.purchaseAssessmentScoreA,
            採購評分A: r.purchaseAssessmentScoreA,
            purchaseAssessmentScoreA: r.purchaseAssessmentScoreA,
            備註: r.remarks,
            說明: r.remarks,
            remarks: r.remarks
          }));
        }
      } else {
        logger.warn('❌ OSAT 未找到匹配的供應商，嘗試的關鍵詞:', questionWordsOSAT);
      }
    }

    // 計算統計數據（特別是趨勢分析時）
    if (contextData.monthlyReports.length > 0) {
      // 檢測問題中詢問的字段（用於趨勢分析）
      const questionLower = question.toLowerCase();
      let trendField = null;
      let trendFieldName = null;
      
      // 定義字段映射表（與之前的字段檢測邏輯一致）
      const fieldMappings = [
        { keywords: ['進貨批數', 'receivedBatches'], field: 'receivedBatches', display: '進貨批數' },
        { keywords: ['退貨批數', 'returnedBatches'], field: 'returnedBatches', display: '退貨批數' },
        { keywords: ['進貨量', '接收數量', 'receivedQuantity'], field: 'receivedQuantity', display: '進貨量' },
        { keywords: ['退貨量', '退回數量', 'returnedQuantity'], field: 'returnedQuantity', display: '退貨量' },
        { keywords: ['考核分數', '考核得分', 'assessmentScore'], field: 'assessmentScore', display: '考核分數' },
        { keywords: ['總品質評分', 'totalQualityScore'], field: 'totalQualityScore', display: '總品質評分' },
        { keywords: ['交期評分', 'deliveryScore'], field: 'deliveryScore', display: '交期評分' },
        { keywords: ['服務評分', 'totalServiceScore'], field: 'totalServiceScore', display: '服務評分' },
        { keywords: ['產線', '產線CCR', '產線件數', 'arr'], field: 'arr', display: '產線CCR' },
        { keywords: ['IQC', 'IQC CCR', 'IQC件數', 'lrr'], field: 'lrr', display: 'IQC CCR' },
        { keywords: ['客訴', '客訴CCR', '客訴件數', '外部CAR', 'externalCAR'], field: 'externalCAR', display: '客訴CCR' },
        { keywords: ['未準時回覆', '未準時回覆CCR', 'untimelyResponseCCR'], field: 'untimelyResponseCCR', display: '未準時回覆CCR' },
        { keywords: ['客訴總件數', '總客訴', '客訴總數', 'totalComplaintCCR'], field: 'totalComplaintCCR', display: '客訴總件數' },
        { keywords: ['嚴重客訴', '嚴重客訴CCR', 'severeComplaintCCR'], field: 'severeComplaintCCR', display: '嚴重客訴' },
        { keywords: ['一般客訴', '一般客訴CCR', 'generalComplaintCCR'], field: 'generalComplaintCCR', display: '一般客訴' },
      ];
      
      // 遍歷字段映射表，找到匹配的字段
      for (const mapping of fieldMappings) {
        const matched = mapping.keywords.some(keyword => 
          question.includes(keyword) || questionLower.includes(keyword.toLowerCase())
        );
        if (matched) {
          trendField = mapping.field;
          trendFieldName = mapping.display;
          break;
        }
      }
      
      // 如果沒有指定字段，默認使用考核得分
      if (!trendField) {
        trendField = 'assessmentScore';
        trendFieldName = '考核分數';
      }
      
      // 提取該字段的值
      const fieldValues = contextData.monthlyReports
        .map(r => {
          // 嘗試多種字段名稱
          const value = r[trendField] !== undefined ? r[trendField] : 
                       (r[trendFieldName] !== undefined ? r[trendFieldName] : null);
          return value !== null && value !== undefined ? value : null;
        })
        .filter(v => v !== null);
      
      if (fieldValues.length > 0) {
        contextData.statistics = {
          averageScore: roundTo3Decimals(fieldValues.reduce((a, b) => a + b, 0) / fieldValues.length),
          maxScore: Math.max(...fieldValues),
          minScore: Math.min(...fieldValues),
          totalVendors: contextData.monthlyReports.length,
          scoreCount: fieldValues.length,
          trendField: trendField,
          trendFieldName: trendFieldName
        };
        
        // 如果是趨勢分析，計算變化（按時間順序）
        if (fieldValues.length >= 2) {
          // 確保按時間順序排序
          const sortedReports = [...contextData.monthlyReports]
            .filter(r => {
              const value = r[trendField] !== undefined ? r[trendField] : 
                           (r[trendFieldName] !== undefined ? r[trendFieldName] : null);
              return value !== null && value !== undefined;
            })
            .sort((a, b) => {
              const seqA = a.year * 12 + a.month;
              const seqB = b.year * 12 + b.month;
              return seqA - seqB;
            });
          
          if (sortedReports.length >= 2) {
            const firstValue = sortedReports[0][trendField] !== undefined ? 
                              sortedReports[0][trendField] : 
                              sortedReports[0][trendFieldName];
            const lastValue = sortedReports[sortedReports.length - 1][trendField] !== undefined ? 
                            sortedReports[sortedReports.length - 1][trendField] : 
                            sortedReports[sortedReports.length - 1][trendFieldName];
            const change = lastValue - firstValue;
            contextData.statistics.trendChange = roundTo3Decimals(change);
            contextData.statistics.trendDirection = change > 0.01 ? '上升' : (change < -0.01 ? '下降' : '穩定');
            contextData.statistics.firstScore = firstValue;
            contextData.statistics.lastScore = lastValue;
            contextData.statistics.firstPeriod = `${sortedReports[0].year}年${sortedReports[0].month}月`;
            contextData.statistics.lastPeriod = `${sortedReports[sortedReports.length - 1].year}年${sortedReports[sortedReports.length - 1].month}月`;
          }
        }
      }
    }

  } catch (error) {
    logger.error('查詢數據庫失敗:', error);
  }

  return contextData;
}

/**
 * 將數據格式化為文本，作為 AI 的上下文
 */
function formatContextData(contextData) {
  let context = `以下是${contextData.systemType === 'sqm-vqm' ? 'SQM/VQM' : 'OSAT'}系統的數據：\n\n`;

  // 如果是稽核類型查詢但沒有數據，優先顯示錯誤信息
  if (contextData._auditTypeQuery && contextData.yearlyReports.length === 0) {
    context += `稽核類型查詢結果：\n`;
    context += `查詢條件：${contextData._auditTypeQuery.year}年，稽核類型="${contextData._auditTypeQuery.requestedType}"\n`;
    context += `結果：沒有找到匹配的供應商。\n`;
    
    // 如果有統計信息，顯示可用的稽核類型
    if (contextData._auditTypeQuery.stats && contextData._auditTypeQuery.stats.availableTypes) {
      const availableTypes = Object.keys(contextData._auditTypeQuery.stats.availableTypes).filter(t => t !== '(null)');
      if (availableTypes.length > 0) {
        context += `\n該年份數據庫中實際存在的稽核類型：\n`;
        availableTypes.forEach(type => {
          const count = contextData._auditTypeQuery.stats.availableTypes[type];
          context += `- "${type}"：${count}家供應商\n`;
        });
      } else {
        context += `\n該年份數據庫中沒有找到任何稽核類型數據（所有供應商的稽核類型都是null）。\n`;
      }
    }
    
    context += `\n提示：請確認：\n`;
    context += `1. 指定的年份是否有年度評核數據\n`;
    context += `2. 稽核類型是否正確（可能的值：实地稽核、文件审核；歷史舊資料可能為 免稽/文件稽核/現場稽核）\n`;
    context += `3. 數據庫中該年份的供應商是否有設定稽核類型\n`;
    return context;
  }

  if (contextData.vendors.length > 0) {
    context += `供應商列表（共${contextData.vendors.length}個）：\n`;
    contextData.vendors.slice(0, 20).forEach(v => {
      context += `- ${v.name}${v.type ? ` (${v.type})` : ''}\n`;
    });
    if (contextData.vendors.length > 20) {
      context += `... 還有 ${contextData.vendors.length - 20} 個供應商\n`;
    }
    context += '\n';
  }

  // OSAT：年度各供應商依客訴總件數排序（年度加總），含主要異常說明摘要
  if (contextData.osatVendorComplaintRanking && contextData.osatVendorComplaintRanking.list.length > 0) {
    const { year, list } = contextData.osatVendorComplaintRanking;
    context += `${year}年各供應商依客訴總件數排序（年度加總，共${list.length}家）：\n`;
    list.forEach((r, i) => {
      context += `${i + 1}. ${r.vendorName}，客訴總件數：${r.totalComplaintCCR}，嚴重客訴：${r.severeComplaintCCR}，一般客訴：${r.generalComplaintCCR}，客訴再發：${r.complaintRecurrenceCCR}，集團CAR：${r.groupCAR}`;
      if (r.remarkSummary) {
        context += `，主要異常說明（摘要）：${r.remarkSummary}`;
      }
      context += '\n';
    });
    context += '\n';
  }

  // 如果有供應商變化比較數據
  if (contextData.statistics && contextData.statistics.vendorChanges && contextData.statistics.vendorChanges.length > 0) {
    context += `供應商變化比較（共${contextData.statistics.totalVendors}個供應商）：\n`;
    contextData.statistics.vendorChanges.slice(0, 10).forEach((vc, idx) => {
      context += `${idx + 1}. ${vc.vendorName}：從 ${vc.firstScore} 到 ${vc.lastScore}，變化 ${vc.change > 0 ? '+' : ''}${vc.change} (${vc.changeDirection})\n`;
    });
    if (contextData.statistics.maxChange) {
      context += `\n變化最大的供應商：${contextData.statistics.maxChange.vendorName}，變化量：${contextData.statistics.maxChange.change} (${contextData.statistics.maxChange.changeDirection})\n`;
    }
    context += '\n';
  }

  if (contextData.monthlyReports.length > 0) {
    // 檢查是否為單個供應商的單筆查詢
    const uniqueVendors = new Set(contextData.monthlyReports.map(r => r.vendorName));
    const isSingleVendorSingleRecord = uniqueVendors.size === 1 && contextData.monthlyReports.length === 1;
    
    if (isSingleVendorSingleRecord) {
      // 單個供應商單筆數據：顯示該筆數據的所有字段
      const r = contextData.monthlyReports[0];
      context += `月評核數據：\n`;
      context += `${r.year}年${r.month}月 - ${r.vendorName}`;
      
      // 基本評分字段
      if (r.assessmentScore !== null && r.assessmentScore !== undefined) {
        context += `，考核得分：${r.assessmentScore}`;
      }
      const qualityScore = r.總品質評分 !== null && r.總品質評分 !== undefined 
        ? r.總品質評分 
        : (r.totalQualityScore !== null && r.totalQualityScore !== undefined ? r.totalQualityScore : null);
      if (qualityScore !== null) {
        context += `，總品質評分：${qualityScore}`;
      }
      const deliveryScore = r.交期評分 !== null && r.交期評分 !== undefined 
        ? r.交期評分 
        : (r.deliveryScore !== null && r.deliveryScore !== undefined ? r.deliveryScore : null);
      if (deliveryScore !== null) {
        context += `，交期評分：${deliveryScore}`;
      }
      const serviceQuality = r.serviceQuality !== null && r.serviceQuality !== undefined ? r.serviceQuality : null;
      const servicePurchase = r.servicePurchase !== null && r.servicePurchase !== undefined ? r.servicePurchase : null;
      const totalServiceScore = r.服務評分 !== null && r.服務評分 !== undefined 
        ? r.服務評分 
        : (r.totalServiceScore !== null && r.totalServiceScore !== undefined 
          ? r.totalServiceScore 
          : ((serviceQuality !== null ? serviceQuality : 0) + (servicePurchase !== null ? servicePurchase : 0)));
      if (totalServiceScore !== null && totalServiceScore !== undefined) {
        if (serviceQuality !== null && servicePurchase !== null) {
          context += `，服務評分：${totalServiceScore}（品質單位：${serviceQuality}分，採購單位：${servicePurchase}分）`;
        } else {
          context += `，服務評分：${totalServiceScore}`;
        }
      }
      
      // 進出貨相關字段
      if (r.進貨批數 !== null && r.進貨批數 !== undefined) {
        context += `，進貨批數：${r.進貨批數}`;
      } else if (r.receivedBatches !== null && r.receivedBatches !== undefined) {
        context += `，進貨批數：${r.receivedBatches}`;
      }
      if (r.退貨批數 !== null && r.退貨批數 !== undefined) {
        context += `，退貨批數：${r.退貨批數}`;
      } else if (r.returnedBatches !== null && r.returnedBatches !== undefined) {
        context += `，退貨批數：${r.returnedBatches}`;
      }
      if (r.進貨量 !== null && r.進貨量 !== undefined) {
        context += `，進貨量：${r.進貨量}`;
      } else if (r.receivedQuantity !== null && r.receivedQuantity !== undefined) {
        context += `，進貨量：${r.receivedQuantity}`;
      }
      if (r.退貨量 !== null && r.退貨量 !== undefined) {
        context += `，退貨量：${r.退貨量}`;
      } else if (r.returnedQuantity !== null && r.returnedQuantity !== undefined) {
        context += `，退貨量：${r.returnedQuantity}`;
      }
      
      // SQM/VQM 品質相關字段
      if (r.產線 !== null && r.產線 !== undefined) {
        context += `，產線CCR：${r.產線}`;
      } else if (r.arr !== null && r.arr !== undefined) {
        context += `，產線CCR：${r.arr}`;
      }
      if (r.IQC !== null && r.IQC !== undefined) {
        context += `，IQC CCR：${r.IQC}`;
      } else if (r.lrr !== null && r.lrr !== undefined) {
        context += `，IQC CCR：${r.lrr}`;
      }
      if (r.客訴 !== null && r.客訴 !== undefined) {
        context += `，客訴CCR：${r.客訴}`;
      } else if (r.externalCAR !== null && r.externalCAR !== undefined) {
        context += `，客訴CCR：${r.externalCAR}`;
      }
      if (r.未準時回覆 !== null && r.未準時回覆 !== undefined) {
        context += `，未準時回覆CCR：${r.未準時回覆}`;
      } else if (r.untimelyResponseCCR !== null && r.untimelyResponseCCR !== undefined) {
        context += `，未準時回覆CCR：${r.untimelyResponseCCR}`;
      }
      
      // OSAT 品質相關字段
      if (r.客訴總件數 !== null && r.客訴總件數 !== undefined) {
        context += `，客訴總件數：${r.客訴總件數}`;
      } else if (r.totalComplaintCCR !== null && r.totalComplaintCCR !== undefined) {
        context += `，客訴總件數：${r.totalComplaintCCR}`;
      }
      if (r.嚴重客訴 !== null && r.嚴重客訴 !== undefined) {
        context += `，嚴重客訴：${r.嚴重客訴}`;
      } else if (r.severeComplaintCCR !== null && r.severeComplaintCCR !== undefined) {
        context += `，嚴重客訴：${r.severeComplaintCCR}`;
      }
      if (r.一般客訴 !== null && r.一般客訴 !== undefined) {
        context += `，一般客訴：${r.一般客訴}`;
      } else if (r.generalComplaintCCR !== null && r.generalComplaintCCR !== undefined) {
        context += `，一般客訴：${r.generalComplaintCCR}`;
      }
      if (r.客訴再發 !== null && r.客訴再發 !== undefined) {
        context += `，客訴再發：${r.客訴再發}`;
      } else if (r.complaintRecurrenceCCR !== null && r.complaintRecurrenceCCR !== undefined) {
        context += `，客訴再發：${r.complaintRecurrenceCCR}`;
      }
      if (r.集團CAR !== null && r.集團CAR !== undefined) {
        context += `，集團CAR：${r.集團CAR}`;
      } else if (r.groupCAR !== null && r.groupCAR !== undefined) {
        context += `，集團CAR：${r.groupCAR}`;
      }
      
      // 採購相關字段
      if (r.遲交 !== null && r.遲交 !== undefined) {
        context += `，遲交次數：${r.遲交}`;
      } else if (r.lateDelivery !== null && r.lateDelivery !== undefined) {
        context += `，遲交次數：${r.lateDelivery}`;
      }
      if (r.特採 !== null && r.特採 !== undefined) {
        context += `，特採次數：${r.特採}`;
      } else if (r.specialApproval !== null && r.specialApproval !== undefined) {
        context += `，特採次數：${r.specialApproval}`;
      }
      if (r.造成斷線 !== null && r.造成斷線 !== undefined) {
        context += `，造成斷線次數：${r.造成斷線}`;
      } else if (r.productionLineStop !== null && r.productionLineStop !== undefined) {
        context += `，造成斷線次數：${r.productionLineStop}`;
      }
      if (r.超額運費 !== null && r.超額運費 !== undefined) {
        context += `，超額運費：${r.超額運費}`;
      } else if (r.excessFreight !== null && r.excessFreight !== undefined) {
        context += `，超額運費：${r.excessFreight}`;
      }
      const singleRemark = r.備註 ?? r.remarks;
      if (singleRemark != null && String(singleRemark).trim()) {
        context += `，備註：${String(singleRemark).trim()}`;
      }
      
      context += '\n\n';
    } else {
      // 多筆數據或多個供應商：顯示完整列表
      context += `月評核數據（共${contextData.monthlyReports.length}筆，按時間順序）：\n`;
      // 按時間順序排序，便於趨勢分析
      const sortedReports = [...contextData.monthlyReports].sort((a, b) => {
        const seqA = a.year * 12 + a.month;
        const seqB = b.year * 12 + b.month;
        return seqA - seqB;
      });
      
      sortedReports.slice(0, 50).forEach(r => {
      context += `${r.year}年${r.month}月 - ${r.vendorName}`;
      // 考核得分/考核分數（兩種說法都支持）
      if (r.assessmentScore !== null && r.assessmentScore !== undefined) {
        context += `，考核得分：${r.assessmentScore}`;
      }
      // 總品質評分
      const qualityScore = r.總品質評分 !== null && r.總品質評分 !== undefined 
        ? r.總品質評分 
        : (r.totalQualityScore !== null && r.totalQualityScore !== undefined ? r.totalQualityScore : null);
      if (qualityScore !== null) {
        context += `，總品質評分：${qualityScore}`;
      }
      // 交期評分
      const deliveryScore = r.交期評分 !== null && r.交期評分 !== undefined 
        ? r.交期評分 
        : (r.deliveryScore !== null && r.deliveryScore !== undefined ? r.deliveryScore : null);
      if (deliveryScore !== null) {
        context += `，交期評分：${deliveryScore}`;
      }
      // 服務評分（總分 = serviceQuality + servicePurchase）
      const serviceQuality = r.serviceQuality !== null && r.serviceQuality !== undefined ? r.serviceQuality : null;
      const servicePurchase = r.servicePurchase !== null && r.servicePurchase !== undefined ? r.servicePurchase : null;
      const totalServiceScore = r.服務評分 !== null && r.服務評分 !== undefined 
        ? r.服務評分 
        : (r.totalServiceScore !== null && r.totalServiceScore !== undefined 
          ? r.totalServiceScore 
          : ((serviceQuality !== null ? serviceQuality : 0) + (servicePurchase !== null ? servicePurchase : 0)));
      
      if (totalServiceScore !== null && totalServiceScore !== undefined) {
        if (serviceQuality !== null && servicePurchase !== null) {
          context += `，服務評分：${totalServiceScore}（品質單位：${serviceQuality}分，採購單位：${servicePurchase}分）`;
        } else {
          context += `，服務評分：${totalServiceScore}`;
        }
      }
      
      // 進出貨相關字段
      if (r.進貨批數 !== null && r.進貨批數 !== undefined) {
        context += `，進貨批數：${r.進貨批數}`;
      } else if (r.receivedBatches !== null && r.receivedBatches !== undefined) {
        context += `，進貨批數：${r.receivedBatches}`;
      }
      if (r.退貨批數 !== null && r.退貨批數 !== undefined) {
        context += `，退貨批數：${r.退貨批數}`;
      } else if (r.returnedBatches !== null && r.returnedBatches !== undefined) {
        context += `，退貨批數：${r.returnedBatches}`;
      }
      
      // SQM/VQM 品質相關字段
      if (r.產線 !== null && r.產線 !== undefined) {
        context += `，產線CCR：${r.產線}`;
      } else if (r.arr !== null && r.arr !== undefined) {
        context += `，產線CCR：${r.arr}`;
      }
      if (r.IQC !== null && r.IQC !== undefined) {
        context += `，IQC CCR：${r.IQC}`;
      } else if (r.lrr !== null && r.lrr !== undefined) {
        context += `，IQC CCR：${r.lrr}`;
      }
      if (r.客訴 !== null && r.客訴 !== undefined) {
        context += `，客訴CCR：${r.客訴}`;
      } else if (r.externalCAR !== null && r.externalCAR !== undefined) {
        context += `，客訴CCR：${r.externalCAR}`;
      }
      
      // OSAT 品質相關字段
      if (r.客訴總件數 !== null && r.客訴總件數 !== undefined) {
        context += `，客訴總件數：${r.客訴總件數}`;
      } else if (r.totalComplaintCCR !== null && r.totalComplaintCCR !== undefined) {
        context += `，客訴總件數：${r.totalComplaintCCR}`;
      }
      if (r.嚴重客訴 !== null && r.嚴重客訴 !== undefined) {
        context += `，嚴重客訴：${r.嚴重客訴}`;
      } else if (r.severeComplaintCCR !== null && r.severeComplaintCCR !== undefined) {
        context += `，嚴重客訴：${r.severeComplaintCCR}`;
      }
      if (r.一般客訴 !== null && r.一般客訴 !== undefined) {
        context += `，一般客訴：${r.一般客訴}`;
      } else if (r.generalComplaintCCR !== null && r.generalComplaintCCR !== undefined) {
        context += `，一般客訴：${r.generalComplaintCCR}`;
      }
      if (r.客訴再發 !== null && r.客訴再發 !== undefined) {
        context += `，客訴再發：${r.客訴再發}`;
      } else if (r.complaintRecurrenceCCR !== null && r.complaintRecurrenceCCR !== undefined) {
        context += `，客訴再發：${r.complaintRecurrenceCCR}`;
      }
      if (r.集團CAR !== null && r.集團CAR !== undefined) {
        context += `，集團CAR：${r.集團CAR}`;
      } else if (r.groupCAR !== null && r.groupCAR !== undefined) {
        context += `，集團CAR：${r.groupCAR}`;
      }
      // 備註（常含客訴／異常說明），回答需呈現完整內容，放寬截斷為 2000 字
      const remark = r.備註 ?? r.remarks;
      if (remark != null && String(remark).trim()) {
        const text = String(remark).trim().slice(0, 2000);
        context += `，備註：${text}${String(remark).length > 2000 ? '…' : ''}`;
      }
      
      context += '\n';
      });
      if (contextData.monthlyReports.length > 50) {
        context += `... 還有 ${contextData.monthlyReports.length - 50} 筆數據\n`;
      }
      context += '\n';
    }
  }

  if (contextData.yearlyReports.length > 0) {
    // 優先檢查是否為稽核類型查詢（使用標記，更可靠）
    const isAuditTypeQuery = contextData._isAuditTypeQuery === true;
    
    // 檢查是否為排名查詢（數據已經按年度分數降序排序）
    const reportsWithScore = contextData.yearlyReports.filter(r => r.annualScore !== null && r.annualScore !== undefined);
    const isRankingQuery = !isAuditTypeQuery && reportsWithScore.length > 1 && 
                           reportsWithScore[0].annualScore >= reportsWithScore[1].annualScore;
    
    logger.debug(`🔍 formatContextData: yearlyReports.length=${contextData.yearlyReports.length}, isAuditTypeQuery=${isAuditTypeQuery}, isRankingQuery=${isRankingQuery}`);
    
    if (isAuditTypeQuery) {
      // 稽核類型查詢：按稽核類型分組顯示
      const auditTypeGroups = {};
      contextData.yearlyReports.forEach(r => {
        const auditType = r.nextYearAuditType || '未設定';
        if (!auditTypeGroups[auditType]) {
          auditTypeGroups[auditType] = [];
        }
        auditTypeGroups[auditType].push(r);
      });
      
      // 獲取請求的稽核類型（如果有的話）
      const requestedType = contextData._requestedAuditType;
      const requestedTypes = contextData._requestedAuditTypes;
      const auditTypes = Object.keys(auditTypeGroups).filter(t => t !== '未設定');
      
      logger.debug(`🔍 格式化稽核類型數據: auditTypes=${JSON.stringify(auditTypes)}, requestedType=${requestedType}, requestedTypes=${JSON.stringify(requestedTypes)}, yearlyReports.length=${contextData.yearlyReports.length}`);
      
      // 如果明確查詢多種類型，按類型分組顯示所有請求的類型
      if (requestedTypes && requestedTypes.length > 0) {
        context += `年度評核數據（按稽核類型分組）：\n`;
        // 按照請求的順序顯示類型
        requestedTypes.forEach(auditType => {
          const vendors = auditTypeGroups[auditType] || [];
          if (vendors.length > 0) {
            context += `\n【${auditType}】（共${vendors.length}家）：\n`;
            vendors.forEach((r, index) => {
              context += `${index + 1}. ${r.vendorName}`;
              if (r.annualScore !== null && r.annualScore !== undefined) {
                context += `，年度分數=${r.annualScore}`;
              }
              if (r.grade) context += `，等級=${r.grade}`;
              context += '\n';
            });
          } else {
            // 即使沒有數據，也顯示該類型（用於明確告知用戶）
            context += `\n【${auditType}】（共0家）：\n`;
            context += `數據中沒有找到相關信息\n`;
          }
        });
      } else if (requestedType && auditTypeGroups[requestedType] && auditTypeGroups[requestedType].length > 0) {
        // 如果明確查詢某種類型，且該類型存在，只顯示該類型
        const vendors = auditTypeGroups[requestedType];
        context += `年度評核數據（稽核類型：${requestedType}，共${vendors.length}家供應商）：\n`;
        vendors.forEach((r, index) => {
          context += `${index + 1}. ${r.vendorName}`;
          if (r.annualScore !== null && r.annualScore !== undefined) {
            context += `，年度分數=${r.annualScore}`;
          }
          if (r.grade) context += `，等級=${r.grade}`;
          context += '\n';
        });
      } else if (auditTypes.length === 1) {
        // 如果只有一種稽核類型，顯示該類型
        const auditType = auditTypes[0];
        const vendors = auditTypeGroups[auditType];
        context += `年度評核數據（稽核類型：${auditType}，共${vendors.length}家供應商）：\n`;
        vendors.forEach((r, index) => {
          context += `${index + 1}. ${r.vendorName}`;
          if (r.annualScore !== null && r.annualScore !== undefined) {
            context += `，年度分數=${r.annualScore}`;
          }
          if (r.grade) context += `，等級=${r.grade}`;
          context += '\n';
        });
      } else {
        // 顯示所有稽核類型分組（統計查詢或未指定類型）
        // 根據系統類型確定稽核類型的顯示順序
        const systemType = contextData.systemType;
        let orderedTypes = Object.keys(auditTypeGroups).filter(t => t !== '未設定');
        
        // 定義各系統的稽核類型優先順序
        if (systemType === 'osat') {
          // OSAT: 無採購紀錄、免稽、文件稽核、現場稽核、現場稽核+製程稽核
          const osatOrder = ['無採購紀錄', '免稽', '文件稽核', '現場稽核', '現場稽核+製程稽核'];
          orderedTypes = osatOrder.filter(t => auditTypeGroups[t] && auditTypeGroups[t].length > 0)
            .concat(orderedTypes.filter(t => !osatOrder.includes(t)));
        } else {
          // SQM/VQM: 文件审核、实地稽核（兼容歷史舊值：免稽/文件稽核/現場稽核）
          const sqmOrder = ['文件审核', '实地稽核', '免稽', '文件稽核', '現場稽核'];
          orderedTypes = sqmOrder.filter(t => auditTypeGroups[t] && auditTypeGroups[t].length > 0)
            .concat(orderedTypes.filter(t => !sqmOrder.includes(t)));
        }
        
        context += `年度評核數據（按稽核類型分組，共${contextData.yearlyReports.length}家供應商）：\n`;
        orderedTypes.forEach(auditType => {
          const vendors = auditTypeGroups[auditType];
          context += `\n【${auditType}】（共${vendors.length}家）：\n`;
          vendors.forEach((r, index) => {
            context += `${index + 1}. ${r.vendorName}`;
            if (r.annualScore !== null && r.annualScore !== undefined) {
              context += `，年度分數=${r.annualScore}`;
            }
            if (r.grade) context += `，等級=${r.grade}`;
            context += '\n';
          });
        });
      }
    } else if (isRankingQuery) {
      context += `年度評核數據（按年度分數排名，共${reportsWithScore.length}筆有年度分數的供應商）：\n`;
      // 排名查詢時，顯示所有供應商（不限制數量）
      reportsWithScore.forEach((r, index) => {
        context += `${index + 1}. ${r.vendorName}，年度分數=${r.annualScore}`;
        if (r.monthlyAssessmentSummary !== null && r.monthlyAssessmentSummary !== undefined) {
          context += `，月考核平均=${r.monthlyAssessmentSummary}`;
        }
        if (r.grade) context += `，等級=${r.grade}`;
        context += '\n';
      });
      if (contextData.yearlyReports.length > reportsWithScore.length) {
        const withoutScore = contextData.yearlyReports.length - reportsWithScore.length;
        context += `\n注意：還有 ${withoutScore} 家供應商沒有年度分數（可能沒有月評核數據）。\n`;
      }
    } else {
      // 檢查是否為單個供應商的年度數據查詢
      const uniqueVendors = new Set(contextData.yearlyReports.map(r => r.vendorName));
      const isSingleVendorYearly = uniqueVendors.size === 1 && contextData.yearlyReports.length === 1;
      
      if (isSingleVendorYearly) {
        // 單個供應商年度數據：顯示完整的年度稽核分數信息
        const r = contextData.yearlyReports[0];
        context += `年度評核數據：\n`;
        context += `${r.vendorName} (${r.year}年)\n`;
        
        // 年度稽核分數（必須顯示所有字段，即使為null）
        context += `年度稽核分數：\n`;
        context += `- VDA: ${r.VDA !== null && r.VDA !== undefined ? r.VDA : '未填寫'}\n`;
        context += `- QSA: ${r.QSA !== null && r.QSA !== undefined ? r.QSA : '未填寫'}\n`;
        context += `- QPA: ${r.QPA !== null && r.QPA !== undefined ? r.QPA : '未填寫'}\n`;
        context += `- HSF: ${r.HSF !== null && r.HSF !== undefined ? r.HSF : '未填寫'}\n`;
        context += `- CSR: ${r.CSR !== null && r.CSR !== undefined ? r.CSR : '未填寫'}\n`;
        
        // 其他字段
        if (r.others !== null && r.others !== undefined) {
          context += `其他評分：${r.others}\n`;
        }
        if (r.monthlyAssessmentSummary !== null && r.monthlyAssessmentSummary !== undefined) {
          context += `月考核平均：${r.monthlyAssessmentSummary}\n`;
        }
        if (r.annualScore !== null && r.annualScore !== undefined) {
          context += `年度分數：${r.annualScore}\n`;
        }
        if (r.grade) {
          context += `等級：${r.grade}\n`;
        }
        if (r.nextYearAuditType) {
          context += `下年度稽核類型：${r.nextYearAuditType}\n`;
        }
        if (r.remarks) {
          context += `備註：${r.remarks}\n`;
        }
        context += '\n';
      } else {
        // 多筆數據或多個供應商：顯示簡化列表
        context += `年度評核數據（共${contextData.yearlyReports.length}筆）：\n`;
        contextData.yearlyReports.slice(0, 10).forEach(r => {
          context += `- ${r.vendorName} (${r.year}年)`;
          if (r.VDA !== null && r.VDA !== undefined) context += `, VDA=${r.VDA}`;
          if (r.QSA !== null && r.QSA !== undefined) context += `, QSA=${r.QSA}`;
          if (r.QPA !== null && r.QPA !== undefined) context += `, QPA=${r.QPA}`;
          if (r.HSF !== null && r.HSF !== undefined) context += `, HSF=${r.HSF}`;
          if (r.CSR !== null && r.CSR !== undefined) context += `, CSR=${r.CSR}`;
          if (r.others !== null && r.others !== undefined) context += `, 其他=${r.others}`;
          if (r.monthlyAssessmentSummary !== null && r.monthlyAssessmentSummary !== undefined) {
            context += `, 月考核平均=${r.monthlyAssessmentSummary}`;
          }
          if (r.annualScore !== null && r.annualScore !== undefined) {
            context += `, 年度分數=${r.annualScore}`;
          }
          if (r.grade) context += `, 等級=${r.grade}`;
          if (r.nextYearAuditType) context += `, 下年度稽核類型=${r.nextYearAuditType}`;
          if (r.remarks) context += `, 備註=${r.remarks}`;
          context += '\n';
        });
        if (contextData.yearlyReports.length > 10) {
          context += `... 還有 ${contextData.yearlyReports.length - 10} 筆數據\n`;
        }
      }
    }
    context += '\n';
  }

  // 計算統計數據（只有在需要趨勢分析或多筆數據時才計算）
  // 如果只有單筆數據且是單個供應商查詢，不計算統計數據
  const isSingleVendorQuery = contextData.monthlyReports.length > 0 && 
                                new Set(contextData.monthlyReports.map(r => r.vendorName)).size === 1 &&
                                contextData.monthlyReports.length === 1;
  const isTrendQuery = contextData.statistics && contextData.statistics.vendorChanges;
  
  if (contextData.monthlyReports.length > 0 && (!isSingleVendorQuery || isTrendQuery)) {
    const scores = contextData.monthlyReports
      .map(r => r.assessmentScore)
      .filter(s => s !== null && s !== undefined);
    
    if (scores.length > 0) {
      // 只有在沒有設置統計數據時才設置（避免覆蓋已有的統計數據）
      if (!contextData.statistics || Object.keys(contextData.statistics).length === 0) {
        contextData.statistics = {
          averageScore: roundTo3Decimals(scores.reduce((a, b) => a + b, 0) / scores.length),
          maxScore: Math.max(...scores),
          minScore: Math.min(...scores),
          totalVendors: contextData.monthlyReports.length,
          scoreCount: scores.length
        };
      }
      
      // 如果是趨勢分析，計算變化（按時間順序）- 只有在有多筆數據時才計算
      if (scores.length >= 2 && !contextData.statistics.trendChange) {
        // 確保按時間順序排序
        const sortedReports = [...contextData.monthlyReports]
          .filter(r => r.assessmentScore !== null && r.assessmentScore !== undefined)
          .sort((a, b) => {
            const seqA = a.year * 12 + a.month;
            const seqB = b.year * 12 + b.month;
            return seqA - seqB;
          });
        
        if (sortedReports.length >= 2) {
          const firstScore = sortedReports[0].assessmentScore;
          const lastScore = sortedReports[sortedReports.length - 1].assessmentScore;
          const change = lastScore - firstScore;
          contextData.statistics.trendChange = roundTo3Decimals(change);
          contextData.statistics.trendDirection = change > 0.01 ? '上升' : (change < -0.01 ? '下降' : '穩定');
          contextData.statistics.firstScore = firstScore;
          contextData.statistics.lastScore = lastScore;
          contextData.statistics.firstPeriod = `${sortedReports[0].year}年${sortedReports[0].month}月`;
          contextData.statistics.lastPeriod = `${sortedReports[sortedReports.length - 1].year}年${sortedReports[sortedReports.length - 1].month}月`;
        }
      }
    }
  }

  // 如果是稽核類型查詢但沒有數據，提供有用的信息
  if (contextData._auditTypeQuery && contextData.yearlyReports.length === 0) {
    context += `稽核類型查詢結果：\n`;
    context += `查詢條件：${contextData._auditTypeQuery.year}年，稽核類型="${contextData._auditTypeQuery.requestedType}"\n`;
    context += `結果：沒有找到匹配的供應商。\n`;
    
    // 如果有統計信息，顯示可用的稽核類型
    if (contextData._auditTypeQuery.stats && contextData._auditTypeQuery.stats.availableTypes) {
      const availableTypes = Object.keys(contextData._auditTypeQuery.stats.availableTypes).filter(t => t !== '(null)');
      if (availableTypes.length > 0) {
        context += `\n該年份數據庫中實際存在的稽核類型：\n`;
        availableTypes.forEach(type => {
          const count = contextData._auditTypeQuery.stats.availableTypes[type];
          context += `- "${type}"：${count}家供應商\n`;
        });
      } else {
        context += `\n該年份數據庫中沒有找到任何稽核類型數據（所有供應商的稽核類型都是null）。\n`;
      }
    }
    
    context += `\n提示：請確認：\n`;
    context += `1. 指定的年份是否有年度評核數據\n`;
    context += `2. 稽核類型是否正確（可能的值：实地稽核、文件审核；歷史舊資料可能為 免稽/文件稽核/現場稽核）\n`;
    context += `3. 數據庫中該年份的供應商是否有設定稽核類型\n`;
    return context;
  }
  
  // 只有在需要統計數據時才顯示（例如：趨勢分析、多筆數據比較）
  // 單個供應商單筆查詢時不顯示統計數據
  const shouldShowStatistics = contextData.monthlyReports.length > 1 || 
                                (contextData.statistics && contextData.statistics.vendorChanges) ||
                                (contextData.statistics && contextData.statistics.trendChange !== undefined);
  
  if (Object.keys(contextData.statistics).length > 0 && shouldShowStatistics) {
    const fieldName = contextData.statistics.trendFieldName || '考核得分';
    context += `統計數據：\n`;
    if (contextData.statistics.averageScore !== undefined) {
      context += `- 平均${fieldName}: ${contextData.statistics.averageScore}\n`;
    }
    if (contextData.statistics.maxScore !== undefined) {
      context += `- 最高${fieldName}: ${contextData.statistics.maxScore}\n`;
    }
    if (contextData.statistics.minScore !== undefined) {
      context += `- 最低${fieldName}: ${contextData.statistics.minScore}\n`;
    }
    if (contextData.statistics.trendChange !== undefined) {
      const firstPeriod = contextData.statistics.firstPeriod || '起始';
      const lastPeriod = contextData.statistics.lastPeriod || '結束';
      context += `- ${fieldName}趨勢分析：從 ${firstPeriod} 的 ${contextData.statistics.firstScore} 到 ${lastPeriod} 的 ${contextData.statistics.lastScore}，變化：${contextData.statistics.trendChange > 0 ? '+' : ''}${contextData.statistics.trendChange} (${contextData.statistics.trendDirection})\n`;
    }
    if (contextData.statistics.totalVendors !== undefined && contextData.monthlyReports.length > 1) {
      context += `- 數據筆數: ${contextData.statistics.scoreCount || contextData.statistics.totalVendors}\n`;
    }
    context += '\n';
  }

  return context;
}

// AI 聊天 API 端點
app.post('/api/ai/chat', auth(), async (req, res) => {
  try {
    const { question, systemType, conversationId } = req.body;

    if (!question || !systemType) {
      return res.status(400).json({ error: '問題和系統類型不能為空' });
    }

    if (systemType !== 'sqm-vqm' && systemType !== 'osat') {
      return res.status(400).json({ error: '系統類型必須是 sqm-vqm 或 osat' });
    }

    const userId = req.user.sub;
    const historyKey = `${userId}_${systemType}`;

    // 獲取或初始化對話歷史
    if (!chatHistory.has(historyKey)) {
      chatHistory.set(historyKey, []);
    }
    const messages = chatHistory.get(historyKey);

    // 如果是新對話，添加系統提示
    if (messages.length === 0) {
      messages.push({
        role: 'system',
        content: `你是一個專業的供應商評估系統助手。請用繁體中文回答問題。

規則：
1. 只基於提供的數據回答，不要編造數據
2. 如果數據中沒有相關信息，直接說"數據中沒有找到相關信息"
3. 回答要簡潔明確，直接回答問題，只回答用戶問的內容
4. 不要主動提供用戶未詢問的額外資訊：不補充說明、不給建議、不延伸解釋、不列出未問到的欄位或供應商。僅回答問題所問的內容。
5. 使用數據中的實際數值，不要猜測
6. 如果用戶只問單個供應商的單筆數據，只回答該筆數據，不要顯示其他供應商的數據或統計信息
7. 只有在用戶明確詢問趨勢、比較、統計時，才提供相關的分析數據

字段說明：

【SQM/VQM 系統字段】
- "考核得分"或"考核分數" = assessmentScore（綜合評分）
- "總品質評分" = qualityAssessmentScoreC 或 totalQualityScore
- "交期評分" = totalPurchaseAssessmentScoreA 或 deliveryScore
- "服務評分" = serviceQuality + servicePurchase（總分10分）
  * serviceQuality：品質單位提供的服務評分（滿分5分）
  * servicePurchase：採購單位提供的服務評分（滿分5分）
  * 總服務評分 = serviceQuality + servicePurchase（滿分10分）
- "產線"、"產線CCR"、"產線件數" = arr（產線CCR件數）
- "IQC"、"IQC CCR"、"IQC件數" = lrr（IQC CCR件數）
- "客訴"、"客訴CCR"、"客訴件數"、"外部CAR" = externalCAR（客訴CCR件數）
- "未準時回覆"、"未準時回覆CCR" = untimelyResponseCCR（未準時回覆件數CCR）
- "其他"、"其他評分" = others（其他評分）
- "品質基數評分"、"基礎評分" = totalBaseScoreB（品質基數評分）
- "品質鑑定總分"、"A加B總分" = qualityAssessmentScoreC1（品質-品管鑑定總分A+B）
- "進貨批數" = receivedBatches
- "退貨批數" = returnedBatches
- "進貨量"、"接收數量" = receivedQuantity
- "退貨量"、"退回數量" = returnedQuantity
- "遲交"、"遲交次數" = lateDelivery（遲交次數，扣5分）
- "特採"、"特採次數" = specialApproval（特採次數，扣5分）
- "造成斷線"、"斷線次數" = productionLineStop（造成斷線次數，扣100分）
- "超額運費"、"產生超額運費" = excessFreight（產生超額運費次數，扣25分）
- "採購鑑定總分"、"採購評分A" = purchaseAssessmentScoreA（採購-採購鑑定總分）
- "備註"、"說明" = remarks（備註）

【OSAT 系統字段】
- "考核得分"或"考核分數" = assessmentScore（綜合評分）
- "總品質評分" = qualityAssessmentScoreWeighted 或 qualityAssessmentScore
- "交期評分" = totalPurchaseAssessmentScoreA 或 deliveryScore
- "服務評分" = serviceQuality + servicePurchase（總分10分）
  * serviceQuality：品質單位提供的服務評分（滿分5分）
  * servicePurchase：採購單位提供的服務評分（滿分5分）
  * 總服務評分 = serviceQuality + servicePurchase（滿分10分）
- "廠區"、"工廠" = factory（廠區：gangshan=岡山，suzhou=蘇州）
- "出貨量"、"出貨量K" = shipmentQuantity（出貨量(K)）
- "進貨批數" = receivedBatches
- "退貨批數" = returnedBatches
- "客訴總件數"、"總客訴"、"客訴總數" = totalComplaintCCR（客訴總件數(CCR件數)）
- "嚴重客訴"、"嚴重客訴CCR" = severeComplaintCCR（嚴重客訴(CCR件數)）
- "一般客訴"、"一般客訴CCR" = generalComplaintCCR（一般客訴(CCR件數)）
- "客訴再發"、"客訴再發CCR" = complaintRecurrenceCCR（客訴再發(CCR件數)）
- "集團CAR"、"CAR件數" = groupCAR（集團CAR(CAR件數)）
- 當用戶詢問「依客訴總件數排序」或客訴相關統計時，**每家供應商都必須列出五項**：客訴總件數、嚴重客訴、一般客訴、客訴再發、集團CAR（若數據中有提供）；不可只列總件數，嚴重／一般／再發／集團CAR 也要一併顯示。
- "準時回覆"、"準時回覆CCR" = timelyResponseCCR（準時回覆件數CCR）
- "未準時回覆"、"未準時回覆CCR" = untimelyResponseCCR（未準時回覆件數CCR）
- "進料允收率評分A1"、"A1評分" = incomingAcceptanceScoreA1（進料允收率品質評分(A1)）
- "進料允收率評分A"、"總分A" = incomingAcceptanceScoreA（進料允收率品質評分(總分A)40%）
- "基礎評分B1"、"B1評分" = baseScoreB1（基礎評分(B1)40%）
- "基礎評分B2"、"B2評分" = baseScoreB2（基礎評分(B2)10%）
- "基礎評分總分B"、"總分B" = totalBaseScoreB（基礎評分(總分B)50%）
- "其他"、"其他評分" = others（其他10%）
- "品質鑑定分數"、"品質評分" = qualityAssessmentScore（品質-品管鑑定分數）
- "遲交"、"遲交次數" = lateDelivery（遲交次數，扣5分）
- "特採"、"特採次數" = specialApproval（特採次數，扣5分）
- "造成斷線"、"斷線次數" = productionLineStop（造成斷線次數，扣100分）
- "超額運費"、"產生超額運費" = excessFreight（產生超額運費次數，扣25分）
- "採購鑑定總分"、"採購評分A" = purchaseAssessmentScoreA（OSAT-採購鑑定總分）
- "備註"、"說明" = remarks（備註；OSAT 每月評核的備註常記載客訴／異常說明，無固定格式）
- 當用戶詢問「某月客訴有哪些」「客訴內容」「異常有哪些」時，請依數據中的客訴件數與備註欄位內容一併整理回答；**回答內容請盡量呈現備註上的所有內容**（數據中已提供者），勿刻意縮短或省略。**格式請易讀**：每個供應商獨立一段，段內用換行並標示欄位，例如「供應商：XXX\n客訴總件數：n，嚴重：n，一般：n，再發：n，集團CAR：n\n備註（客訴內容）：…」；段與段之間空一行。勿將多筆供應商或多欄位擠在同一行
- 當用戶要求「以柏拉圖方式統計」客訴／異常時，請依數據中的客訴件數（或嚴重客訴）降序排列，並列出：序號、供應商、件數、佔比、累計佔比，以文字呈現柏拉圖概念（累計佔比通常可標示 80% 重點）
- 當用戶詢問「異常問題分類統計」「異常項目分類」等時，請根據各供應商的備註／異常說明文字（例如本說明中的「主要異常說明（摘要）」），歸納主要異常類別（如：殘膠、標籤貼錯、電性良品、封裝外觀不良…），統計各類別的件數與大致佔比，並可說明前幾大異常類別對總客訴的貢獻比例（概念上類似柏拉圖，但以問題類別為主）。

【年度稽核分數字段】
- "年度稽核分數" = 包括以下5個字段，需要分別回答：
  * VDA：VDA稽核分數（可能為null/未填寫）
  * QSA：QSA稽核分數（可能為null/未填寫）
  * QPA：QPA稽核分數（可能為null/未填寫）
  * HSF：HSF稽核分數（可能為null/未填寫）
  * CSR：CSR稽核分數（可能為null/未填寫）
- 當用戶詢問"年度稽核分數"時，必須分別列出VDA、QSA、QPA、HSF、CSR的數值，如果某個字段為null或未填寫，請明確說明"未填寫"或"空值"

【計算字段（不在數據庫中，由系統計算）】
- "年度分數"、"年度分數" = annualScore（年度分數，計算公式：如果有年度稽核分數 = (月考核平均 * 0.9) + (年度稽核組件 * 0.1) - 其他；如果沒有年度稽核分數 = 月考核平均 - 其他）
- "月考核平均"、"月考核平均分數" = monthlyAssessmentSummary（該年度1-12月考核得分的平均值）
- "等級" = grade（根據年度分數計算：A>=95, B>=85, C>=75, D>=60, E<60）
- "下年度稽核計畫"、"下年度稽核類型"、"稽核類型" = nextYearAuditType（下年度稽核計畫的稽核類型）
  * SQM/VQM 可能的值：实地稽核（国内廠商）、文件审核（国外/海外廠商）；歷史舊資料可能仍為 免稽/文件稽核/現場稽核
  * OSAT 可能的值：無採購紀錄、免稽、文件稽核、現場稽核、現場稽核+製程稽核（共5種）
  * 當用戶詢問"統計稽核類型"、"有哪些稽核類型"、"各別有幾家"等問題時，系統會自動識別並統計所有存在的稽核類型及其數量

重要：
1. 當用戶詢問"服務評分"時，僅回答總服務評分（serviceQuality + servicePurchase）；僅在用戶明確詢問組成或細項時才說明品質單位/採購單位分數。
2. 當用戶詢問"年度分數"時，系統會自動計算並提供該供應商在指定年份的年度分數。
3. 當用戶詢問"年度稽核分數"時，必須分別回答VDA、QSA、QPA、HSF、CSR的數值，如果某個字段為null或未填寫，請明確說明"未填寫"或"空值"。
4. 年度分數的計算需要該年度有月評核數據，如果沒有月評核數據，年度分數為null。
5. 當用戶詢問"排名"時，請完整列出所有供應商的排名，不要省略任何供應商。如果數據中提供了完整的排名列表（例如：1. 供應商A，2. 供應商B...），請直接使用該列表，完整顯示所有排名，不要重新排序或省略任何供應商。

請直接回答用戶的問題，不要輸出無關內容，也不要主動提供其他未詢問的資訊。`
      });
    }

    // 解析問題
    const parsedInfo = parseQuestion(question, systemType);
    logger.debug('🔍 問題解析結果:', JSON.stringify(parsedInfo, null, 2));

    // 提取問題中的關鍵詞（用於錯誤提示）
    const questionWords = question
      .replace(/[年月日]/g, ' ')
      .replace(/\d+/g, ' ')
      .split(/[\s，,。.、]/)
      .filter(word => word.length >= 2 && !['評核', '評鑑', '數據', '查詢', '顯示', '的', '是', '有', '哪些', '趨勢', '如何', '變化', '走勢', '哪一家', '哪個', '最大', '最小'].includes(word))
      .map(word => word.trim());

    // 查詢數據庫
    const contextData = await queryDatabase(question, parsedInfo, systemType, userId);
    logger.debug('📊 查詢到的數據:', {
      vendors: contextData.vendors?.length || 0,
      monthlyReports: contextData.monthlyReports?.length || 0,
      yearlyReports: contextData.yearlyReports?.length || 0,
      statistics: Object.keys(contextData.statistics || {}).length,
      hasVendorChanges: !!(contextData.statistics && contextData.statistics.vendorChanges && contextData.statistics.vendorChanges.length > 0),
      queryType: parsedInfo.queryType,
      auditType: parsedInfo.auditType
    });
    
    // 如果是稽核類型查詢（含「統計、各別有幾家」），在 contextData 中添加標記，讓 formatContextData 知道這是稽核類型查詢
    if (parsedInfo.queryType === 'audit_type' || parsedInfo.queryType === 'audit_type_statistics') {
      contextData._isAuditTypeQuery = true;
      if (parsedInfo.auditTypes && parsedInfo.auditTypes.length > 0) {
        // 多種類型查詢
        contextData._requestedAuditTypes = parsedInfo.auditTypes;
        contextData._requestedAuditType = null;
        logger.info(`✅ 標記為多種稽核類型查詢: ${JSON.stringify(parsedInfo.auditTypes)}, yearlyReports數量=${contextData.yearlyReports.length}`);
      } else if (parsedInfo.auditType) {
        // 單一類型查詢
        contextData._requestedAuditType = parsedInfo.auditType;
        contextData._requestedAuditTypes = null;
        logger.info(`✅ 標記為單一稽核類型查詢: ${parsedInfo.auditType}, yearlyReports數量=${contextData.yearlyReports.length}`);
      } else {
        // 未指定類型，查詢所有類型
        contextData._requestedAuditType = null;
        contextData._requestedAuditTypes = null;
        logger.info(`✅ 標記為稽核類型查詢（未指定類型，查詢所有）: yearlyReports數量=${contextData.yearlyReports.length}`);
      }
    }

    // 格式化上下文數據
    const contextText = formatContextData(contextData);
    
    // 檢查數據是否足夠回答問題
    let dataStatusMessage = '';
    const hasData = contextData.monthlyReports.length > 0 || contextData.yearlyReports.length > 0 || 
                    (contextData.statistics && contextData.statistics.vendorChanges && contextData.statistics.vendorChanges.length > 0);
    
    // 如果是稽核類型查詢但沒有數據，提供更詳細的錯誤信息
    if (parsedInfo.queryType === 'audit_type' && parsedInfo.auditType && contextData.yearlyReports.length === 0) {
      // 使用已保存的統計信息（在 queryDatabase 中已保存）
      contextData._auditTypeQuery = {
        requestedType: parsedInfo.auditType,
        year: parsedInfo.year || parsedInfo.startYear,
        stats: contextData._auditTypeStats
      };
      logger.warn(`⚠️ 稽核類型查詢沒有找到匹配的數據: 查詢類型="${parsedInfo.auditType}", 年份=${parsedInfo.year || parsedInfo.startYear}`);
      logger.info(`   _auditTypeQuery已設置:`, contextData._auditTypeQuery);
      if (contextData._auditTypeStats) {
        logger.info(`   可用的稽核類型:`, Object.keys(contextData._auditTypeStats.availableTypes || {}));
        logger.info(`   各類型數量:`, contextData._auditTypeStats.availableTypes);
      }
    }
    
    if (!hasData || contextText.trim().length === 0) {
      // 構建詳細的錯誤信息
      const missingInfo = [];
      if (parsedInfo.startYear && parsedInfo.startMonth && parsedInfo.endYear && parsedInfo.endMonth) {
        missingInfo.push(`時間範圍：${parsedInfo.startYear}年${parsedInfo.startMonth}月 到 ${parsedInfo.endYear}年${parsedInfo.endMonth}月`);
      } else if (parsedInfo.year && parsedInfo.month) {
        missingInfo.push(`時間：${parsedInfo.year}年${parsedInfo.month}月`);
      } else if (parsedInfo.year) {
        missingInfo.push(`年份：${parsedInfo.year}年`);
      }
      
      if (parsedInfo.needAllVendors) {
        missingInfo.push('查詢類型：所有供應商比較');
      } else if (questionWords.length > 0) {
        missingInfo.push(`嘗試匹配的供應商關鍵詞：${questionWords.join(', ')}`);
      }
      
      // 檢查是否有供應商變化數據
      const hasVendorChanges = contextData.statistics && contextData.statistics.vendorChanges && contextData.statistics.vendorChanges.length > 0;
      
      dataStatusMessage = `\n\n⚠️ 數據查詢結果：\n- 查詢條件：${missingInfo.join('，')}\n- 找到的供應商數量：${contextData.vendors.length}\n- 找到的月評核記錄：${contextData.monthlyReports.length}筆\n- 找到的年度評核記錄：${contextData.yearlyReports.length}筆\n- 供應商變化比較數據：${hasVendorChanges ? `${contextData.statistics.vendorChanges.length}個供應商` : '無'}\n\n如果沒有找到數據，可能的原因：\n1. 指定的時間範圍內沒有數據\n2. 供應商名稱不匹配（如果是單個供應商查詢）\n3. 數據尚未錄入系統\n4. 時間範圍內所有供應商都只有一筆數據，無法計算變化`;
    }

    // 添加用戶問題和上下文數據
    const userMessageWithContext = contextText.trim().length > 0
      ? `問題：${question}\n\n相關數據：\n${contextText}\n\n請根據以上數據回答問題。`
      : `問題：${question}${dataStatusMessage}\n\n請告知用戶沒有找到相關數據，並說明可能的原因。`;
    
    messages.push({
      role: 'user',
      content: userMessageWithContext
    });

    // 調用 Ollama API
    logger.debug('🤖 準備調用 Ollama API，消息數量:', messages.length);
    logger.debug('🤖 最後一條用戶消息:', messages[messages.length - 1]?.content?.substring(0, 200));
    
    // 根據查詢類型決定 max_tokens（回答可能很長時提高限制，避免截斷）
    const isRankingQuery = parsedInfo.queryType === 'ranking' || 
                          (contextData.yearlyReports.length > 0 && 
                           (question.includes('排名') || question.includes('排序') || question.includes('排位')));
    const isLongListQuery = question.includes('客訴有哪些') || question.includes('客訴內容') || question.includes('異常有哪些') ||
                           question.includes('柏拉圖') ||
                           (question.includes('異常') && (question.includes('統計') || question.includes('分類'))) ||
                           (contextData.monthlyReports && contextData.monthlyReports.length > 10);
    const maxTokens = (isRankingQuery || isLongListQuery) ? 4000 : 1000;
    
    logger.debug('🤖 查詢類型:', parsedInfo.queryType, '，長列表查詢:', isLongListQuery, '，使用 max_tokens:', maxTokens);
    
    const ollamaResponse = await chatWithOllama(messages, false, maxTokens);
    
    logger.debug('🤖 Ollama API 響應:', JSON.stringify(ollamaResponse).substring(0, 500));
    
    // 獲取 AI 回答
    let aiMessage = '';
    
    // 檢查不同的響應格式
    if (ollamaResponse.choices && ollamaResponse.choices.length > 0) {
      aiMessage = ollamaResponse.choices[0].message?.content || '';
    } else if (ollamaResponse.message) {
      aiMessage = ollamaResponse.message.content || '';
    } else if (ollamaResponse.content) {
      aiMessage = ollamaResponse.content;
    } else if (typeof ollamaResponse === 'string') {
      aiMessage = ollamaResponse;
    }
    
    logger.debug('🤖 AI 原始回答長度:', aiMessage.length);
    logger.debug('🤖 AI 原始回答前200字符:', aiMessage.substring(0, 200));
    
    // 檢查是否為亂碼
    if (aiMessage && aiMessage.length > 0) {
      // 計算中文字符比例
      const chineseChars = (aiMessage.match(/[\u4e00-\u9fa5]/g) || []).length;
      const totalChars = aiMessage.length;
      const chineseRatio = chineseChars / totalChars;
      
      logger.debug('🤖 回答中文字符比例:', chineseRatio);
      
      // 如果中文字符比例太低（< 0.1），可能是亂碼
      if (chineseRatio < 0.1 && totalChars > 100) {
        logger.warn('🤖 檢測到可能的亂碼，嘗試從數據中直接提取答案');
        
        // 嘗試從上下文數據中直接提取答案
        if (contextData.monthlyReports.length > 0) {
          // 從問題中提取供應商名稱和時間信息
          const questionUpper = question.toUpperCase();
          let matchedReport = null;
          
          // 查找匹配的報告
          for (const report of contextData.monthlyReports) {
            const vendorNameUpper = (report.vendorName || '').toUpperCase();
            const yearMatch = parsedInfo.year ? report.year === parsedInfo.year : true;
            const monthMatch = parsedInfo.month ? report.month === parsedInfo.month : true;
            
            // 檢查供應商名稱是否匹配（支持模糊匹配）
            // 提取問題中的供應商關鍵詞（去除年份、月份、常見詞彙）
            const questionKeywords = questionUpper
              .replace(/\d{4}年?/g, '')
              .replace(/\d{1,2}月/g, '')
              .replace(/[年月日考核分數得分評核評鑑數據查詢顯示的]/g, '')
              .trim();
            
            const vendorMatch = questionUpper.includes(vendorNameUpper) || 
                               vendorNameUpper.includes(questionKeywords) ||
                               questionKeywords.includes(vendorNameUpper.replace(/\d+/g, '').trim());
            
            logger.debug('🤖 匹配檢查:', {
              questionKeywords,
              vendorName: report.vendorName,
              vendorNameUpper,
              vendorMatch,
              yearMatch,
              monthMatch,
              year: report.year,
              month: report.month,
              parsedYear: parsedInfo.year,
              parsedMonth: parsedInfo.month
            });
            
            if (vendorMatch && yearMatch && monthMatch) {
              matchedReport = report;
              logger.debug('🤖 找到匹配的報告:', matchedReport);
              break;
            }
          }
          
          if (matchedReport) {
            // 檢測問題中詢問的字段
            const questionLower = question.toLowerCase();
            let fieldName = null;
            let fieldValue = null;
            let fieldDisplayName = null;
            
            // 定義字段映射表（按優先級順序，更具體的匹配在前）
            const fieldMappings = [
              // 基本字段
              { keywords: ['進貨批數', 'receivedBatches'], field: 'receivedBatches', display: '進貨批數' },
              { keywords: ['退貨批數', 'returnedBatches'], field: 'returnedBatches', display: '退貨批數' },
              { keywords: ['進貨量', '接收數量', 'receivedQuantity'], field: 'receivedQuantity', display: '進貨量' },
              { keywords: ['退貨量', '退回數量', 'returnedQuantity'], field: 'returnedQuantity', display: '退貨量' },
              { keywords: ['考核分數', '考核得分', 'assessmentScore'], field: 'assessmentScore', display: '考核分數' },
              { keywords: ['總品質評分', 'totalQualityScore'], field: 'totalQualityScore', display: '總品質評分' },
              { keywords: ['交期評分', 'deliveryScore'], field: 'deliveryScore', display: '交期評分' },
              { keywords: ['服務評分', 'totalServiceScore'], field: 'totalServiceScore', display: '服務評分' },
              
              // SQM/VQM 專用字段
              { keywords: ['產線', '產線CCR', '產線件數', 'arr'], field: 'arr', display: '產線CCR' },
              { keywords: ['IQC', 'IQC CCR', 'IQC件數', 'lrr'], field: 'lrr', display: 'IQC CCR' },
              { keywords: ['客訴', '客訴CCR', '客訴件數', '外部CAR', 'externalCAR'], field: 'externalCAR', display: '客訴CCR' },
              { keywords: ['未準時回覆', '未準時回覆CCR', 'untimelyResponseCCR'], field: 'untimelyResponseCCR', display: '未準時回覆CCR' },
              { keywords: ['其他', '其他評分', 'others'], field: 'others', display: '其他評分' },
              { keywords: ['品質基數評分', '基礎評分', 'totalBaseScoreB'], field: 'totalBaseScoreB', display: '品質基數評分' },
              { keywords: ['品質鑑定總分', 'A加B總分', 'qualityAssessmentScoreC1'], field: 'qualityAssessmentScoreC1', display: '品質鑑定總分' },
              { keywords: ['遲交', '遲交次數', 'lateDelivery'], field: 'lateDelivery', display: '遲交次數' },
              { keywords: ['特採', '特採次數', 'specialApproval'], field: 'specialApproval', display: '特採次數' },
              { keywords: ['造成斷線', '斷線次數', 'productionLineStop'], field: 'productionLineStop', display: '造成斷線次數' },
              { keywords: ['超額運費', '產生超額運費', 'excessFreight'], field: 'excessFreight', display: '超額運費' },
              { keywords: ['採購鑑定總分', '採購評分A', 'purchaseAssessmentScoreA'], field: 'purchaseAssessmentScoreA', display: '採購鑑定總分' },
              
              // OSAT 專用字段
              { keywords: ['客訴總件數', '總客訴', '客訴總數', 'totalComplaintCCR'], field: 'totalComplaintCCR', display: '客訴總件數' },
              { keywords: ['嚴重客訴', '嚴重客訴CCR', 'severeComplaintCCR'], field: 'severeComplaintCCR', display: '嚴重客訴' },
              { keywords: ['一般客訴', '一般客訴CCR', 'generalComplaintCCR'], field: 'generalComplaintCCR', display: '一般客訴' },
              { keywords: ['客訴再發', '客訴再發CCR', 'complaintRecurrenceCCR'], field: 'complaintRecurrenceCCR', display: '客訴再發' },
              { keywords: ['集團CAR', 'CAR件數', 'groupCAR'], field: 'groupCAR', display: '集團CAR' },
              { keywords: ['準時回覆', '準時回覆CCR', 'timelyResponseCCR'], field: 'timelyResponseCCR', display: '準時回覆' },
              { keywords: ['進料允收率評分A1', 'A1評分', 'incomingAcceptanceScoreA1'], field: 'incomingAcceptanceScoreA1', display: '進料允收率評分A1' },
              { keywords: ['進料允收率評分A', '總分A', 'incomingAcceptanceScoreA'], field: 'incomingAcceptanceScoreA', display: '進料允收率評分A' },
              { keywords: ['基礎評分B1', 'B1評分', 'baseScoreB1'], field: 'baseScoreB1', display: '基礎評分B1' },
              { keywords: ['基礎評分B2', 'B2評分', 'baseScoreB2'], field: 'baseScoreB2', display: '基礎評分B2' },
              { keywords: ['基礎評分總分B', '總分B', 'totalBaseScoreB'], field: 'totalBaseScoreB', display: '基礎評分總分B' },
              { keywords: ['品質鑑定分數', '品質評分', 'qualityAssessmentScore'], field: 'qualityAssessmentScore', display: '品質鑑定分數' },
              { keywords: ['出貨量', '出貨量K', 'shipmentQuantity'], field: 'shipmentQuantity', display: '出貨量' },
              { keywords: ['廠區', '工廠', 'factory'], field: 'factory', display: '廠區' },
            ];
            
            // 遍歷字段映射表，找到匹配的字段
            for (const mapping of fieldMappings) {
              const matched = mapping.keywords.some(keyword => 
                question.includes(keyword) || questionLower.includes(keyword.toLowerCase())
              );
              if (matched && matchedReport[mapping.field] !== undefined) {
                fieldName = mapping.field;
                fieldDisplayName = mapping.display;
                fieldValue = matchedReport[mapping.field];
                break;
              }
            }
            
            // 如果找到了匹配的字段
            if (fieldName && fieldValue !== null && fieldValue !== undefined) {
              aiMessage = `根據數據庫記錄，${matchedReport.vendorName} 在 ${matchedReport.year}年${matchedReport.month}月的${fieldDisplayName}是 ${fieldValue}。`;
            } else if (fieldName) {
              aiMessage = `根據數據庫記錄，${matchedReport.vendorName} 在 ${matchedReport.year}年${matchedReport.month}月有評核記錄，但${fieldDisplayName}尚未填寫。`;
            } else if (matchedReport.assessmentScore !== null && matchedReport.assessmentScore !== undefined) {
              // 如果沒有指定字段，默認返回考核分數
              aiMessage = `根據數據庫記錄，${matchedReport.vendorName} 在 ${matchedReport.year}年${matchedReport.month}月的考核分數是 ${matchedReport.assessmentScore}。`;
            } else {
              aiMessage = `根據數據庫記錄，${matchedReport.vendorName} 在 ${matchedReport.year}年${matchedReport.month}月有評核記錄，但考核分數尚未填寫。`;
            }
          } else {
            const yearText = parsedInfo.year ? `${parsedInfo.year}年` : '';
            const monthText = parsedInfo.month ? `${parsedInfo.month}月` : '';
            aiMessage = `抱歉，在數據中沒有找到相關供應商在${yearText}${monthText}的記錄。`;
          }
        } else if (contextData.osatVendorComplaintRanking && contextData.osatVendorComplaintRanking.list.length > 0) {
          // 年度查詢無月報但有年度客訴彙總時，用彙總數據組出異常／客訴分類統計
          const { year, list } = contextData.osatVendorComplaintRanking;
          const totalComplaints = list.reduce((sum, r) => sum + (r.totalComplaintCCR || 0), 0);
          const totalSevere = list.reduce((sum, r) => sum + (r.severeComplaintCCR || 0), 0);
          const totalGeneral = list.reduce((sum, r) => sum + (r.generalComplaintCCR || 0), 0);
          const totalRecurrence = list.reduce((sum, r) => sum + (r.complaintRecurrenceCCR || 0), 0);
          const totalGroupCAR = list.reduce((sum, r) => sum + (r.groupCAR || 0), 0);
          let fallback = `${year}年異常問題（客訴）分類統計\n\n`;
          fallback += `共 ${list.length} 家供應商。\n`;
          fallback += `全年度彙總：客訴總件數 ${totalComplaints}，嚴重客訴 ${totalSevere}，一般客訴 ${totalGeneral}，客訴再發 ${totalRecurrence}，集團CAR ${totalGroupCAR}。\n\n`;
          fallback += `依客訴總件數排序：\n`;
          list.slice(0, 30).forEach((r, i) => {
            fallback += `${i + 1}. ${r.vendorName}：總件數 ${r.totalComplaintCCR || 0}，嚴重 ${r.severeComplaintCCR || 0}，一般 ${r.generalComplaintCCR || 0}，再發 ${r.complaintRecurrenceCCR || 0}，集團CAR ${r.groupCAR || 0}\n`;
          });
          if (list.length > 30) fallback += `… 其餘 ${list.length - 30} 家略。\n`;
          aiMessage = fallback;
        } else if (contextData.yearlyReports && contextData.yearlyReports.length > 0) {
          aiMessage = `目前數據中有 ${contextData.yearlyReports.length} 筆年度評核記錄，但無法從中直接整理出異常問題分類統計。請改問「某年某月客訴有哪些」或「某年依客訴總件數排序」以取得明細。`;
        } else {
          aiMessage = '抱歉，數據中沒有相關的月評核記錄。';
        }
      } else {
        // 清理回答：移除可能的亂碼和無關內容
        // 移除過長的無意義重複字符
        aiMessage = aiMessage.replace(/(.)\1{10,}/g, '$1');
        // 移除過多的標點符號
        aiMessage = aiMessage.replace(/[。，、]{5,}/g, '。');
        // 移除常見的亂碼模式
        aiMessage = aiMessage.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s，。、：；！？（）【】\d.%-]/g, '');
      }
    }
    
    if (!aiMessage || aiMessage.trim().length === 0) {
      // 如果還是沒有答案，嘗試從數據中直接提取
      // 優先：單一供應商年度查詢且問「年度稽核分數」時，直接從 yearlyReports 組出回覆
      if (contextData.yearlyReports && contextData.yearlyReports.length === 1 && parsedInfo.year && !parsedInfo.month &&
          (question.includes('年度稽核') || question.includes('稽核分數'))) {
        const r = contextData.yearlyReports[0];
        const vendorBase = (r.vendorName || '').replace(/\d+/g, '').trim();
        if (vendorBase.length >= 2 && (question.includes(r.vendorName) || question.includes(vendorBase))) {
          let msg = `${r.vendorName} ${parsedInfo.year}年年度稽核分數：\n`;
          msg += `VDA：${r.VDA !== null && r.VDA !== undefined ? r.VDA : '未填寫'}，QSA：${r.QSA !== null && r.QSA !== undefined ? r.QSA : '未填寫'}，QPA：${r.QPA !== null && r.QPA !== undefined ? r.QPA : '未填寫'}，HSF：${r.HSF !== null && r.HSF !== undefined ? r.HSF : '未填寫'}，CSR：${r.CSR !== null && r.CSR !== undefined ? r.CSR : '未填寫'}`;
          if (r.monthlyAssessmentSummary != null) msg += `\n月考核平均：${r.monthlyAssessmentSummary}`;
          if (r.annualScore != null) msg += `\n年度分數：${r.annualScore}`;
          if (r.nextYearAuditType) msg += `\n下年度稽核類型：${r.nextYearAuditType}`;
          aiMessage = msg;
        }
      }
      if (!aiMessage && contextData.monthlyReports.length > 0) {
        // 從問題中提取供應商名稱和時間信息
        const questionUpper = question.toUpperCase();
        let matchedReport = null;
        
        // 查找匹配的報告
        for (const report of contextData.monthlyReports) {
          const vendorNameUpper = (report.vendorName || '').toUpperCase();
          const yearMatch = parsedInfo.year ? report.year === parsedInfo.year : true;
          const monthMatch = parsedInfo.month ? report.month === parsedInfo.month : true;
          
          // 檢查供應商名稱是否匹配（支持模糊匹配：問「力源」可對應「力源106325」）
          const vendorBase = vendorNameUpper.replace(/\d+/g, '').trim();
          const vendorMatch = questionUpper.includes(vendorNameUpper) ||
            vendorNameUpper.includes(questionUpper.replace(/[年月日\d\s]/g, '').trim()) ||
            (vendorBase.length >= 2 && questionUpper.includes(vendorBase));
          
          if (vendorMatch && yearMatch && monthMatch) {
            matchedReport = report;
            break;
          }
        }
        
        if (matchedReport) {
          // 檢測問題中詢問的字段
          const questionLower = question.toLowerCase();
          let fieldName = null;
          let fieldValue = null;
          let fieldDisplayName = null;
          
          // 定義字段映射表（按優先級順序，更具體的匹配在前）
          const fieldMappings = [
            // 基本字段
            { keywords: ['進貨批數', 'receivedBatches'], field: 'receivedBatches', display: '進貨批數' },
            { keywords: ['退貨批數', 'returnedBatches'], field: 'returnedBatches', display: '退貨批數' },
            { keywords: ['進貨量', '接收數量', 'receivedQuantity'], field: 'receivedQuantity', display: '進貨量' },
            { keywords: ['退貨量', '退回數量', 'returnedQuantity'], field: 'returnedQuantity', display: '退貨量' },
            { keywords: ['考核分數', '考核得分', 'assessmentScore'], field: 'assessmentScore', display: '考核分數' },
            { keywords: ['總品質評分', 'totalQualityScore'], field: 'totalQualityScore', display: '總品質評分' },
            { keywords: ['交期評分', 'deliveryScore'], field: 'deliveryScore', display: '交期評分' },
            { keywords: ['服務評分', 'totalServiceScore'], field: 'totalServiceScore', display: '服務評分' },
            
            // SQM/VQM 專用字段
            { keywords: ['產線', '產線CCR', '產線件數', 'arr'], field: 'arr', display: '產線CCR' },
            { keywords: ['IQC', 'IQC CCR', 'IQC件數', 'lrr'], field: 'lrr', display: 'IQC CCR' },
            { keywords: ['客訴', '客訴CCR', '客訴件數', '外部CAR', 'externalCAR'], field: 'externalCAR', display: '客訴CCR' },
            { keywords: ['未準時回覆', '未準時回覆CCR', 'untimelyResponseCCR'], field: 'untimelyResponseCCR', display: '未準時回覆CCR' },
            { keywords: ['其他', '其他評分', 'others'], field: 'others', display: '其他評分' },
            { keywords: ['品質基數評分', '基礎評分', 'totalBaseScoreB'], field: 'totalBaseScoreB', display: '品質基數評分' },
            { keywords: ['品質鑑定總分', 'A加B總分', 'qualityAssessmentScoreC1'], field: 'qualityAssessmentScoreC1', display: '品質鑑定總分' },
            { keywords: ['遲交', '遲交次數', 'lateDelivery'], field: 'lateDelivery', display: '遲交次數' },
            { keywords: ['特採', '特採次數', 'specialApproval'], field: 'specialApproval', display: '特採次數' },
            { keywords: ['造成斷線', '斷線次數', 'productionLineStop'], field: 'productionLineStop', display: '造成斷線次數' },
            { keywords: ['超額運費', '產生超額運費', 'excessFreight'], field: 'excessFreight', display: '超額運費' },
            { keywords: ['採購鑑定總分', '採購評分A', 'purchaseAssessmentScoreA'], field: 'purchaseAssessmentScoreA', display: '採購鑑定總分' },
            
            // OSAT 專用字段
            { keywords: ['客訴總件數', '總客訴', '客訴總數', 'totalComplaintCCR'], field: 'totalComplaintCCR', display: '客訴總件數' },
            { keywords: ['嚴重客訴', '嚴重客訴CCR', 'severeComplaintCCR'], field: 'severeComplaintCCR', display: '嚴重客訴' },
            { keywords: ['一般客訴', '一般客訴CCR', 'generalComplaintCCR'], field: 'generalComplaintCCR', display: '一般客訴' },
            { keywords: ['客訴再發', '客訴再發CCR', 'complaintRecurrenceCCR'], field: 'complaintRecurrenceCCR', display: '客訴再發' },
            { keywords: ['集團CAR', 'CAR件數', 'groupCAR'], field: 'groupCAR', display: '集團CAR' },
            { keywords: ['準時回覆', '準時回覆CCR', 'timelyResponseCCR'], field: 'timelyResponseCCR', display: '準時回覆' },
            { keywords: ['進料允收率評分A1', 'A1評分', 'incomingAcceptanceScoreA1'], field: 'incomingAcceptanceScoreA1', display: '進料允收率評分A1' },
            { keywords: ['進料允收率評分A', '總分A', 'incomingAcceptanceScoreA'], field: 'incomingAcceptanceScoreA', display: '進料允收率評分A' },
            { keywords: ['基礎評分B1', 'B1評分', 'baseScoreB1'], field: 'baseScoreB1', display: '基礎評分B1' },
            { keywords: ['基礎評分B2', 'B2評分', 'baseScoreB2'], field: 'baseScoreB2', display: '基礎評分B2' },
            { keywords: ['基礎評分總分B', '總分B', 'totalBaseScoreB'], field: 'totalBaseScoreB', display: '基礎評分總分B' },
            { keywords: ['品質鑑定分數', '品質評分', 'qualityAssessmentScore'], field: 'qualityAssessmentScore', display: '品質鑑定分數' },
            { keywords: ['出貨量', '出貨量K', 'shipmentQuantity'], field: 'shipmentQuantity', display: '出貨量' },
            { keywords: ['廠區', '工廠', 'factory'], field: 'factory', display: '廠區' },
          ];
          
          // 遍歷字段映射表，找到匹配的字段
          for (const mapping of fieldMappings) {
            const matched = mapping.keywords.some(keyword => 
              question.includes(keyword) || questionLower.includes(keyword.toLowerCase())
            );
            if (matched && matchedReport[mapping.field] !== undefined) {
              fieldName = mapping.field;
              fieldDisplayName = mapping.display;
              fieldValue = matchedReport[mapping.field];
              break;
            }
          }
          
          // 如果找到了匹配的字段
          if (fieldName && fieldValue !== null && fieldValue !== undefined) {
            aiMessage = `根據數據庫記錄，${matchedReport.vendorName} 在 ${matchedReport.year}年${matchedReport.month}月的${fieldDisplayName}是 ${fieldValue}。`;
          } else if (fieldName) {
            aiMessage = `根據數據庫記錄，${matchedReport.vendorName} 在 ${matchedReport.year}年${matchedReport.month}月有評核記錄，但${fieldDisplayName}尚未填寫。`;
          } else if (matchedReport.assessmentScore !== null && matchedReport.assessmentScore !== undefined) {
            // 如果沒有指定字段，默認返回考核分數
            aiMessage = `根據數據庫記錄，${matchedReport.vendorName} 在 ${matchedReport.year}年${matchedReport.month}月的考核分數是 ${matchedReport.assessmentScore}。`;
          } else {
            aiMessage = `根據數據庫記錄，${matchedReport.vendorName} 在 ${matchedReport.year}年${matchedReport.month}月有評核記錄，但考核分數尚未填寫。`;
          }
        } else {
          const yearText = parsedInfo.year ? `${parsedInfo.year}年` : '';
          const monthText = parsedInfo.month ? `${parsedInfo.month}月` : '';
          aiMessage = `抱歉，在數據中沒有找到相關供應商在${yearText}${monthText}的記錄。`;
        }
      }
      if (!aiMessage || aiMessage.trim().length === 0) {
        aiMessage = '抱歉，我無法回答這個問題。請確認數據中是否有相關信息。';
      }
    }

    // 添加 AI 回答到歷史
    messages.push({
      role: 'assistant',
      content: aiMessage
    });

    // 限制歷史長度（保留最近 20 輪對話）
    if (messages.length > 40) { // 20 輪 = 40 條消息（用戶+助手）
      const systemMessage = messages[0];
      messages.splice(1, messages.length - 39); // 保留系統消息和最近 19 輪對話
    }

    // 機器人後台：若無法回答則歸類為問題類型「unanswered」，並寫入未回答 Log
    const isUnanswered = aiMessage && (
      aiMessage.includes('數據中沒有找到相關信息') ||
      aiMessage.includes('沒有找到相關') ||
      aiMessage.includes('沒有相關的') ||
      aiMessage.includes('無法回答') ||
      aiMessage.includes('沒有找到匹配的供應商')
    );

    // 機器人後台：紀錄每次使用（供統計使用頻率與問題類型）；無法回答時 queryType 記為 unanswered
    const username = req.user.username || String(req.user.sub);
    try {
      await prisma.aiUsageLog.create({
        data: {
          userId: req.user.sub,
          username,
          systemType,
          queryType: isUnanswered ? 'unanswered' : (parsedInfo.queryType || 'query')
        }
      });
    } catch (logErr) {
      logger.warn('AI 使用紀錄寫入失敗:', logErr.message);
    }

    if (isUnanswered && question) {
      try {
        await prisma.aiUnansweredLog.create({
          data: {
            userId: req.user.sub,
            username,
            question: question.trim().slice(0, 4000),
            systemType,
            aiResponse: (aiMessage || '').slice(0, 2000),
            resolved: false
          }
        });
      } catch (logErr) {
        logger.warn('AI 未回答 Log 寫入失敗:', logErr.message);
      }
    }

    // 返回回答
    res.json({
      answer: aiMessage,
      contextData: contextData, // 返回原始數據，前端可以用來製作表格和圖表
      conversationId: conversationId || historyKey
    });

  } catch (error) {
    logger.error('AI 聊天錯誤:', error);
    res.status(500).json({ 
      error: 'server_error', 
      message: error.message || 'AI 聊天服務暫時不可用' 
    });
  }
});

// 清除對話歷史 API
app.delete('/api/ai/chat/history', auth(), async (req, res) => {
  try {
    const { systemType } = req.body;
    const userId = req.user.sub;

    if (systemType) {
      const historyKey = `${userId}_${systemType}`;
      chatHistory.delete(historyKey);
      res.json({ success: true, message: '對話歷史已清除' });
    } else {
      // 清除該用戶的所有對話歷史
      const keysToDelete = [];
      for (const key of chatHistory.keys()) {
        if (key.startsWith(`${userId}_`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => chatHistory.delete(key));
      res.json({ success: true, message: '所有對話歷史已清除' });
    }
  } catch (error) {
    logger.error('清除對話歷史錯誤:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// ========== 機器人後台（僅 admin） ==========
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: '僅限最高權限' });
  }
  next();
}

// 1. 無法回答 Log：列表、編輯、刪除
app.get('/api/admin/ai/unanswered', auth(), requireAdmin, async (req, res) => {
  try {
    const { resolved, limit = 100, offset = 0 } = req.query;
    const where = {};
    if (resolved !== undefined && resolved !== '') {
      where.resolved = resolved === 'true';
    }
    const [list, total] = await Promise.all([
      prisma.aiUnansweredLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limit) || 100, 500),
        skip: Math.max(0, Number(offset) || 0)
      }),
      prisma.aiUnansweredLog.count({ where })
    ]);
    res.json({ list, total });
  } catch (e) {
    logger.error('AI unanswered list:', e);
    res.status(500).json({ error: 'server_error' });
  }
});

app.put('/api/admin/ai/unanswered/:id', auth(), requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};
    const data = {};
    if (body.notes !== undefined) data.notes = body.notes;
    if (typeof body.resolved === 'boolean') data.resolved = body.resolved;
    const log = await prisma.aiUnansweredLog.update({
      where: { id },
      data
    });
    res.json(log);
  } catch (e) {
    logger.error('AI unanswered update:', e);
    res.status(500).json({ error: 'server_error' });
  }
});

app.delete('/api/admin/ai/unanswered/:id', auth(), requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.aiUnansweredLog.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    logger.error('AI unanswered delete:', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// 2. 使用頻率：依帳戶統計
app.get('/api/admin/ai/stats/usage', auth(), requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};
    if (startDate || endDate) {
      where.askedAt = {};
      if (startDate) where.askedAt.gte = new Date(startDate);
      if (endDate) where.askedAt.lte = new Date(endDate);
    }
    const raw = await prisma.aiUsageLog.groupBy({
      by: ['userId', 'username'],
      where,
      _count: { id: true }
    });
    const list = raw.map(r => ({ userId: r.userId, username: r.username, count: r._count.id }));
    list.sort((a, b) => b.count - a.count);
    res.json(list);
  } catch (e) {
    logger.error('AI stats usage:', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// 3. 問題類型統計
app.get('/api/admin/ai/stats/question-types', auth(), requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};
    if (startDate || endDate) {
      where.askedAt = {};
      if (startDate) where.askedAt.gte = new Date(startDate);
      if (endDate) where.askedAt.lte = new Date(endDate);
    }
    const raw = await prisma.aiUsageLog.groupBy({
      by: ['queryType'],
      where,
      _count: { id: true }
    });
    const list = raw.map(r => ({ queryType: r.queryType || '(未分類)', count: r._count.id }));
    list.sort((a, b) => b.count - a.count);
    res.json(list);
  } catch (e) {
    logger.error('AI stats question-types:', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// 4. LLM 管理：取得目前設定
app.get('/api/admin/ai/llm', auth(), requireAdmin, async (req, res) => {
  try {
    const config = await getLlmConfig();
    res.json({
      model: config.model,
      apiUrl: config.apiUrl ? `${config.apiUrl.slice(0, 30)}...` : '(env)',
      apiUrlFull: config.apiUrl
    });
  } catch (e) {
    logger.error('AI llm get:', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// 4. LLM 管理：更新設定（寫入 DB，覆蓋 env）
app.put('/api/admin/ai/llm', auth(), requireAdmin, async (req, res) => {
  try {
    const { model, apiUrl, apiKey } = req.body || {};
    const upsert = async (key, val) => {
      if (val === undefined || val === null) return;
      await prisma.aiLlmConfig.upsert({
        where: { configKey: key },
        create: { configKey: key, configVal: String(val) },
        update: { configVal: String(val) }
      });
    };
    await upsert('OLLAMA_MODEL', model);
    await upsert('OLLAMA_API_URL', apiUrl);
    await upsert('OLLAMA_API_KEY', apiKey);
    const config = await getLlmConfig();
    res.json({ success: true, model: config.model, apiUrl: config.apiUrl ? `${config.apiUrl.slice(0, 30)}...` : '(env)' });
  } catch (e) {
    logger.error('AI llm put:', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// SQM/VQM年度評鑑彙整 - 從月評核資料彙整年度評鑑（優化版本）
app.get('/api/sqm-vqm/yearly-evaluation/:year', auth(), async (req, res) => {
  const year = Number(req.params.year)
  const cacheKey = `sqm-vqm-yearly-${year}`;
  
  // 檢查緩存 - 啟用緩存以提升性能
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    logger.debug(`📦 使用緩存數據: SQM/VQM ${year}年度評鑑資料`);
    res.set('X-Cache-Status', 'HIT');
    res.set('X-Cache-Age', Math.round((Date.now() - cached.timestamp) / 1000).toString());
    return res.json(cached.data);
  }
  
  try {
    logger.debug(`🔍 開始彙整SQM/VQM ${year}年度評鑑資料...`)
    const startTime = Date.now();
    
    // 優化：一次性獲取所有相關數據，避免N+1查詢
    const [vendors, allMonthlyReports, annualInputs] = await Promise.all([
      // 獲取所有SQM/VQM供應商
      prisma.sQMVQMVendor.findMany({
        orderBy: { name: 'asc' }
      }),
      // 獲取指定年份的所有季評核資料
      prisma.sQMVQMMonthlyReport.findMany({
        where: { year },
        orderBy: [{ vendorId: 'asc' }, { quarter: 'asc' }]
      }),
      // 獲取指定年份的所有年度輸入資料
      prisma.sQMVQMAnnualInput.findMany({
        where: { year }
      })
    ]);
    
    logger.debug(`📊 找到 ${vendors.length} 個SQM/VQM供應商，${allMonthlyReports.length} 筆月評核資料`)
    logger.debug(`📋 月評核資料範例:`, allMonthlyReports.slice(0, 3))
    
    // 建立索引以提高查詢效率
    const monthlyReportsByVendor = {};
    const annualInputsByVendor = {};
    
    // 按供應商ID分組月評核資料
    allMonthlyReports.forEach(report => {
      if (!monthlyReportsByVendor[report.vendorId]) {
        monthlyReportsByVendor[report.vendorId] = [];
      }
      monthlyReportsByVendor[report.vendorId].push(report);
    });
    
    // 按供應商ID分組年度輸入資料
    annualInputs.forEach(input => {
      annualInputsByVendor[input.vendorId] = input;
    });
    
    // 重新排序：先有資料的供應商，再沒有資料的供應商
    const vendorsWithData = [];
    const vendorsWithoutData = [];
    
    vendors.forEach(vendor => {
      const monthlyReports = monthlyReportsByVendor[vendor.id] || [];
      
      if (monthlyReports.length > 0) {
        vendorsWithData.push(vendor);
      } else {
        vendorsWithoutData.push(vendor);
      }
    });
    
    // 排序：按名稱排序
    vendorsWithData.sort((a, b) => a.name.localeCompare(b.name));
    vendorsWithoutData.sort((a, b) => a.name.localeCompare(b.name));
    
    const sortedVendors = [...vendorsWithData, ...vendorsWithoutData];
    logger.debug(`📊 排序完成：${sortedVendors.length} 個SQM/VQM供應商`)
    
    const yearlyEvaluations = []
    
    for (const vendor of sortedVendors) {
      logger.debug(`🔍 處理供應商: ${vendor.name}`)
      
      // 從索引中獲取該供應商的月評核資料
      const monthlyReports = monthlyReportsByVendor[vendor.id] || [];
      const annualInput = annualInputsByVendor[vendor.id];
      
      logger.debug(`📊 供應商 ${vendor.name} 在 ${year} 年有 ${monthlyReports.length} 筆月評核資料`)
      
      // 計算年度統計
      const monthlyStats = {
        // 月考核分數統計
        assessmentScores: [],
        // 交易月數統計
        tradingMonths: 0,
        // 交易總量統計
        totalReceivedQuantity: 0,
        totalReceivedBatches: 0,
        // 品質統計
        totalArr: 0,
        totalLrr: 0,
        totalExternalCAR: 0,
        // 採購統計
        totalLateDelivery: 0,
        totalSpecialApproval: 0,
        totalProductionLineStop: 0,
        totalExcessFreight: 0
      }
      
      // 處理每個月的資料
      for (const report of monthlyReports) {
        // 月考核分數
        if (report.assessmentScore !== null) {
          monthlyStats.assessmentScores.push(report.assessmentScore)
        }
        
        // 交易統計
        if (report.receivedBatches > 0) {
          monthlyStats.tradingMonths++
        }
        
        // 數量統計
        const receivedQty = parseFloat(report.receivedQuantity || '0');
        if (!isNaN(receivedQty)) {
          monthlyStats.totalReceivedQuantity += receivedQty;
        }
        monthlyStats.totalReceivedBatches += report.receivedBatches || 0
        
        // 品質統計
        monthlyStats.totalArr += report.arr || 0
        monthlyStats.totalLrr += report.lrr || 0
        monthlyStats.totalExternalCAR += report.externalCAR || 0
        
        // 採購統計
        monthlyStats.totalLateDelivery += report.lateDelivery || 0
        monthlyStats.totalSpecialApproval += report.specialApproval || 0
        monthlyStats.totalProductionLineStop += report.productionLineStop || 0
        monthlyStats.totalExcessFreight += report.excessFreight || 0
      }
      
      // 計算年度平均分數
      const monthlyAssessmentAverage = monthlyStats.assessmentScores.length > 0 
        ? roundTo3Decimals(monthlyStats.assessmentScores.reduce((a, b) => a + b, 0) / monthlyStats.assessmentScores.length)
        : null
      
      // 構建季考核得分資料 (Q1~Q4) - 從季評核資料中取得
      const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
      const monthlyAssessmentScores = {};
      for (const q of quarters) {
        const quarterReport = monthlyReports.find(r => r.quarter === q);
        monthlyAssessmentScores[q] = quarterReport?.assessmentScore ?? null;
      }

      // 構建季採購量資料 (Q1~Q4) - 從季評核資料中取得
      const monthlyPurchaseQuantities = {};
      for (const q of quarters) {
        const quarterReport = monthlyReports.find(r => r.quarter === q);
        monthlyPurchaseQuantities[q] = quarterReport?.receivedBatches ?? null;
      }
      
      // 計算年度分數 - 與OSAT邏輯一致
      const auditComponent = getAuditComponent(annualInput);
      const others = annualInput?.others ?? 0;
      const annualScore = monthlyAssessmentAverage !== null 
        ? (() => {
            // 如果沒有年度稽核分數，只根據月考核分數計算（不扣分）
            if (auditComponent === 0) {
              return roundTo3Decimals(monthlyAssessmentAverage - others);
            }
            
            return roundTo3Decimals((monthlyAssessmentAverage * 0.9) + (auditComponent * 0.1) - others);
          })()
        : null;
      
      // 計算等級
      const grade = annualScore !== null ? (() => {
        if (annualScore >= 95) return 'A';
        if (annualScore >= 85) return 'B';
        if (annualScore >= 75) return 'C';
        if (annualScore >= 60) return 'D';
        return 'E';
      })() : null;
      
      // 下年度稽核類型：已手動儲存的值優先；沒有儲存值時才依地區給預設值。
      // 国内/海外 → 实地稽核；国外 → 文件审核（與前端邏輯一致）
      const supplierType2 = getSupplierType(vendor);
      const defaultNextYearAuditType = supplierType2 === '国外' ? '文件审核' : '实地稽核';
      const nextYearAuditType = annualInput?.nextYearAuditType || defaultNextYearAuditType;
      
      const yearlyEvaluation = {
        vendorName: vendor.name,
        vendorType: vendor.vendorType,
        supplierType: supplierType2, // 歸一化後的供應商地區（国内/国外/海外）
        year,
        monthlyAssessmentSummary: monthlyAssessmentAverage,
        monthlyAssessmentScores,
        monthlyPurchaseQuantities,
        purchaseTradingMonths: monthlyStats.tradingMonths,
        purchaseTotalQuantity: monthlyStats.totalReceivedBatches,
        annualAudit: annualInput ? {
          VDA: annualInput.VDA,
          QSA: annualInput.QSA,
          QPA: annualInput.QPA,
          HSF: annualInput.HSF,
          CSR: annualInput.CSR,
        } : {},
        others: annualInput?.others ?? null,
        nextYearAuditType,
        remarks: annualInput?.remarks ?? null,
        annualScore,
        grade,
        
        // 保留原始統計資料供內部使用
        _internalStats: {
          totalReceivedQuantity: roundTo3Decimals(monthlyStats.totalReceivedQuantity),
          totalReceivedBatches: monthlyStats.totalReceivedBatches,
          totalArr: monthlyStats.totalArr,
          totalLrr: monthlyStats.totalLrr,
          totalExternalCAR: monthlyStats.totalExternalCAR,
          totalLateDelivery: monthlyStats.totalLateDelivery,
          totalSpecialApproval: monthlyStats.totalSpecialApproval,
          totalProductionLineStop: monthlyStats.totalProductionLineStop,
          totalExcessFreight: monthlyStats.totalExcessFreight,
          monthlyReports: monthlyReports.map(report => ({
            quarter: report.quarter,
            assessmentScore: report.assessmentScore,
            receivedQuantity: report.receivedQuantity,
            receivedBatches: report.receivedBatches,
            arr: report.arr,
            lrr: report.lrr,
            externalCAR: report.externalCAR,
            lateDelivery: report.lateDelivery,
            specialApproval: report.specialApproval,
            productionLineStop: report.productionLineStop,
            excessFreight: report.excessFreight
          }))
        }
      }
      
      yearlyEvaluations.push(yearlyEvaluation)
    }
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    logger.info(`✅ SQM/VQM ${year}年度評鑑彙整完成，共 ${yearlyEvaluations.length} 個供應商，耗時 ${processingTime}ms`)
    
    // 存儲到緩存
    cache.set(cacheKey, {
      data: yearlyEvaluations,
      timestamp: Date.now()
    });
    
    // 清理過期緩存
    for (const [key, value] of cache.entries()) {
      if ((Date.now() - value.timestamp) > CACHE_TTL) {
        cache.delete(key);
      }
    }
    
    // 添加性能監控頭部
    res.set('X-Processing-Time', processingTime.toString());
    res.set('X-Total-Vendors', yearlyEvaluations.length.toString());
    res.set('X-Total-Monthly-Reports', allMonthlyReports.length.toString());
    res.set('X-Cache-Status', 'MISS');
    
    res.json(yearlyEvaluations)
    
  } catch (e) {
    logger.error('SQM/VQM年度評鑑彙整錯誤:', e)
    res.status(500).json({ error: 'server_error', details: e.message })
  }
})

// OSAT年度評鑑彙整 - 從月評核資料彙整年度評鑑（優化版本）
app.get('/api/osat/yearly-evaluation/:year', auth(), async (req, res) => {
  const year = Number(req.params.year)
  const cacheKey = `osat-yearly-${year}`;
  
  // 檢查緩存 - 啟用緩存以提升性能
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    logger.debug(`📦 使用緩存數據: OSAT ${year}年度評鑑資料`);
    res.set('X-Cache-Status', 'HIT');
    res.set('X-Cache-Age', Math.round((Date.now() - cached.timestamp) / 1000).toString());
    return res.json(cached.data);
  }
  
  try {
    logger.debug(`🔍 開始彙整OSAT ${year}年度評鑑資料...`)
    const startTime = Date.now();
    
    // 優化：一次性獲取所有相關數據，避免N+1查詢
    const [vendors, allMonthlyReports, annualInputs, monthlyPurchases] = await Promise.all([
      // 獲取所有OSAT供應商
      prisma.oSATVendor.findMany({
      orderBy: { name: 'asc' }
      }),
      // 獲取指定年份的所有月評核資料
      prisma.oSATMonthlyReport.findMany({
        where: { year },
        orderBy: [{ vendorId: 'asc' }, { month: 'asc' }]
      }),
      // 獲取指定年份的所有年度輸入資料
      prisma.oSATAnnualInput.findMany({
        where: { year }
      }),
      // 獲取指定年份的所有月採購量資料
      prisma.oSATMonthlyPurchase.findMany({
        where: { year },
        orderBy: [{ vendorId: 'asc' }, { month: 'asc' }]
      })
    ]);
    
    logger.debug(`📊 找到 ${vendors.length} 個OSAT供應商，${allMonthlyReports.length} 筆月評核資料，${monthlyPurchases.length} 筆月採購量資料`)
    logger.debug(`📋 月評核資料範例:`, allMonthlyReports.slice(0, 3))
    
    // 建立索引以提高查詢效率
    const monthlyReportsByVendor = {};
    const annualInputsByVendor = {};
    const monthlyPurchasesByVendor = {};
    
    // 按供應商ID分組月評核資料
    allMonthlyReports.forEach(report => {
      if (!monthlyReportsByVendor[report.vendorId]) {
        monthlyReportsByVendor[report.vendorId] = [];
      }
      monthlyReportsByVendor[report.vendorId].push(report);
    });
    
    // 按供應商ID分組月採購量資料
    monthlyPurchases.forEach(purchase => {
      if (!monthlyPurchasesByVendor[purchase.vendorId]) {
        monthlyPurchasesByVendor[purchase.vendorId] = [];
      }
      monthlyPurchasesByVendor[purchase.vendorId].push(purchase);
    });
    
    // 按供應商ID分組年度輸入資料
    annualInputs.forEach(input => {
      annualInputsByVendor[input.vendorId] = input;
    });
    
    // 重新排序：先有岡山資料的供應商，再有蘇州資料的供應商，最後是沒有資料的供應商
    const vendorsWithData = [];
    const vendorsWithoutData = [];
    
    vendors.forEach(vendor => {
      const monthlyReports = monthlyReportsByVendor[vendor.id] || [];
      const hasGangshanData = monthlyReports.some(r => r.factory === 'gangshan');
      const hasSuzhouData = monthlyReports.some(r => r.factory === 'suzhou');
      
      if (hasGangshanData || hasSuzhouData) {
        vendorsWithData.push({ ...vendor, hasGangshanData, hasSuzhouData });
      } else {
        vendorsWithoutData.push(vendor);
      }
    });
    
    // 排序：先岡山，再蘇州，最後無資料
    vendorsWithData.sort((a, b) => {
      if (a.hasGangshanData && !b.hasGangshanData) return -1;
      if (!a.hasGangshanData && b.hasGangshanData) return 1;
      if (a.hasSuzhouData && !b.hasSuzhouData) return -1;
      if (!a.hasSuzhouData && b.hasSuzhouData) return 1;
      return a.name.localeCompare(b.name);
    });
    
    const sortedVendors = [...vendorsWithData, ...vendorsWithoutData];
    logger.debug(`📊 排序完成：${sortedVendors.length} 個OSAT供應商`)
    
    const yearlyEvaluations = []
    
    for (const vendor of sortedVendors) {
      logger.debug(`🔍 處理供應商: ${vendor.name}`)
      
      // 從索引中獲取該供應商的月評核資料
      const monthlyReports = monthlyReportsByVendor[vendor.id] || [];
      const annualInput = annualInputsByVendor[vendor.id];
      
      logger.debug(`📊 供應商 ${vendor.name} 在 ${year} 年有 ${monthlyReports.length} 筆月評核資料`)
      
      // 計算年度統計
      const monthlyStats = {
        // 月考核分數統計
        assessmentScores: [],
        // 交易月數統計
        tradingMonths: 0,
        // 交易總量統計
        totalShipmentQuantity: 0,
        totalReceivedBatches: 0,
        // 品質統計
        totalComplaintCCR: 0,
        severeComplaintCCR: 0,
        generalComplaintCCR: 0,
        // 採購統計
        totalLateDelivery: 0,
        totalSpecialApproval: 0,
        totalProductionLineStop: 0,
        totalExcessFreight: 0,
        // 廠區統計
        gangshanMonths: 0,
        suzhouMonths: 0
      }
      
      // 處理每個月的資料
      for (const report of monthlyReports) {
        // 月考核分數
        if (report.assessmentScore !== null) {
          monthlyStats.assessmentScores.push(report.assessmentScore)
        }
        
        // 交易統計
        if (report.receivedBatches > 0) {
          monthlyStats.tradingMonths++
        }
        
        // 數量統計 - 修正交易總量計算
        const shipmentQty = parseFloat(report.shipmentQuantity || '0');
        if (!isNaN(shipmentQty)) {
          monthlyStats.totalShipmentQuantity += shipmentQty;
        }
        monthlyStats.totalReceivedBatches += report.receivedBatches || 0
        
        // 品質統計
        monthlyStats.totalComplaintCCR += report.totalComplaintCCR || 0
        monthlyStats.severeComplaintCCR += report.severeComplaintCCR || 0
        monthlyStats.generalComplaintCCR += report.generalComplaintCCR || 0
        
        // 採購統計
        monthlyStats.totalLateDelivery += report.lateDelivery || 0
        monthlyStats.totalSpecialApproval += report.specialApproval || 0
        monthlyStats.totalProductionLineStop += report.productionLineStop || 0
        monthlyStats.totalExcessFreight += report.excessFreight || 0
        
        // 廠區統計
        if (report.factory === 'gangshan') {
          monthlyStats.gangshanMonths++
        } else if (report.factory === 'suzhou') {
          monthlyStats.suzhouMonths++
        }
      }
      
      // 計算年度平均分數
      const monthlyAssessmentAverage = monthlyStats.assessmentScores.length > 0 
        ? roundTo3Decimals(monthlyStats.assessmentScores.reduce((a, b) => a + b, 0) / monthlyStats.assessmentScores.length)
        : null
      
      // 構建月考核得分資料 (1月~12月) - 從月評核資料中取得
      const monthlyAssessmentScores = {};
      for (let month = 1; month <= 12; month++) {
        const monthReport = monthlyReports.find(r => r.month === month);
        monthlyAssessmentScores[`${month}月`] = monthReport?.assessmentScore ?? null;
      }
      
      // 構建月採購量資料 (1月~12月) - 從OSATMonthlyPurchase資料表讀取
      const monthlyPurchaseQuantities = {};
      const vendorPurchases = monthlyPurchasesByVendor[vendor.id] || [];
      
      for (let month = 1; month <= 12; month++) {
        const purchaseRecord = vendorPurchases.find(p => p.month === month);
        monthlyPurchaseQuantities[`${month}月`] = purchaseRecord ? purchaseRecord.purchaseQuantity : null;
      }
      
      // 構建年度評鑑資料 - 對應網頁欄位格式
      const yearlyEvaluation = {
        vendorName: vendor.name,
        vendorId: vendor.id,
        year,
        
        // 月考核得分 (1月~12月)
        monthlyAssessmentScores,
        monthlyAssessmentSummary: monthlyAssessmentAverage, // 月考核平均分數
        
        // 月採購量 (1月~12月)
        monthlyPurchaseQuantities,
        purchaseTradingMonths: vendorPurchases.length, // 交易月數 - 從月採購量資料計算
        purchaseTotalQuantity: vendorPurchases.reduce((sum, p) => sum + p.purchaseQuantity, 0), // 交易總量 - 從月採購量資料計算
        
        // 年度稽核
        annualAudit: {
          VDA: annualInput?.VDA ?? null,
          QSA: annualInput?.QSA ?? null,
          QPA: annualInput?.QPA ?? null,
          HSF: annualInput?.HSF ?? null,
          CSR: annualInput?.CSR ?? null,
        },
        
        // 其他欄位
        others: annualInput?.others ?? null,
        // 下年度稽核類型：自動計算（與前端邏輯一致）
        nextYearAuditType: (() => {
          const tradingMonths = vendorPurchases.length; // 交易月數
          const totalQuantity = vendorPurchases.reduce((sum, p) => sum + p.purchaseQuantity, 0); // 交易總量
          
          // 1. 無採購紀錄條件：交易月數 = 0 或 null
          if (tradingMonths === 0 || tradingMonths === null) {
            return '無採購紀錄';
          }
          
          // 2. 計算年度等級（用於判定）
          let grade = null;
          if (monthlyAssessmentAverage) {
            const auditComponent = getAuditComponent(annualInput);
            const othersValue = annualInput?.others || 0;
            
            let score;
            if (auditComponent === 0) {
              score = roundTo3Decimals(monthlyAssessmentAverage - othersValue);
            } else {
              score = roundTo3Decimals((monthlyAssessmentAverage * 0.9) + (auditComponent * 0.1) - othersValue);
            }
            
            if (score >= 95) grade = 'A';
            else if (score >= 85) grade = 'B';
            else if (score >= 75) grade = 'C';
            else if (score >= 60) grade = 'D';
            else grade = 'E';
          }
          
          // 3. 根據新的判定標準決定稽核類型
          if (tradingMonths >= 6) {
            if (totalQuantity >= 8000) {
              if (grade === 'A' || grade === 'B') {
                return '現場稽核';
              } else if (grade === 'C' || grade === 'D' || grade === 'E') {
                return '現場稽核+製程稽核';
              } else {
                return '現場稽核'; // 預設值
              }
            } else if (totalQuantity >= 4000) {
              if (grade === 'A' || grade === 'B') {
                return '文件稽核';
              } else if (grade === 'C' || grade === 'D' || grade === 'E') {
                return '現場稽核';
              } else {
                return '文件稽核'; // 預設值
              }
            } else {
              if (grade === 'A' || grade === 'B') {
                return '免稽';
              } else if (grade === 'C' || grade === 'D' || grade === 'E') {
                return '現場稽核';
              } else {
                return '免稽'; // 預設值
              }
            }
          } else { // tradingMonths <= 5
            if (totalQuantity >= 8000) {
              return '現場稽核';
            } else if (totalQuantity >= 4000) {
              if (grade === 'A' || grade === 'B') {
                return '文件稽核';
              } else if (grade === 'C' || grade === 'D' || grade === 'E') {
                return '現場稽核';
              } else {
                return '文件稽核'; // 預設值
              }
            } else {
              if (grade === 'A' || grade === 'B') {
                return '免稽';
              } else if (grade === 'C' || grade === 'D' || grade === 'E') {
                return '現場稽核';
              } else {
                return '免稽'; // 預設值
              }
            }
          }
        })(),
        remarks: annualInput?.remarks ?? null,
        
        // 計算欄位
        annualScore: monthlyAssessmentAverage ? 
          (() => {
            const auditComponent = getAuditComponent(annualInput);
            const othersValue = annualInput?.others || 0;
            
            // 如果沒有年度稽核分數，只根據月考核分數計算（不扣分）
            if (auditComponent === 0) {
              return roundTo3Decimals(monthlyAssessmentAverage - othersValue);
            }
            
            return roundTo3Decimals((monthlyAssessmentAverage * 0.9) + (auditComponent * 0.1) - othersValue);
          })() : 
          null,
        grade: (() => {
          if (!monthlyAssessmentAverage) return null;
          
          const auditComponent = getAuditComponent(annualInput);
          const othersValue = annualInput?.others || 0;
          
          let score;
          // 如果沒有年度稽核分數，只根據月考核分數計算（不扣分）
          if (auditComponent === 0) {
            score = roundTo3Decimals(monthlyAssessmentAverage - othersValue);
          } else {
            score = roundTo3Decimals((monthlyAssessmentAverage * 0.9) + (auditComponent * 0.1) - othersValue);
          }
          
          if (score >= 95) return 'A';
          if (score >= 85) return 'B';
          if (score >= 75) return 'C';
          if (score >= 60) return 'D';
          return 'E';
        })(),
        
        // 保留原始統計資料供內部使用
        _internalStats: {
          totalShipmentQuantity: roundTo3Decimals(monthlyStats.totalShipmentQuantity),
          totalReceivedBatches: monthlyStats.totalReceivedBatches,
          totalComplaintCCR: monthlyStats.totalComplaintCCR,
          severeComplaintCCR: monthlyStats.severeComplaintCCR,
          generalComplaintCCR: monthlyStats.generalComplaintCCR,
          totalLateDelivery: monthlyStats.totalLateDelivery,
          totalSpecialApproval: monthlyStats.totalSpecialApproval,
          totalProductionLineStop: monthlyStats.totalProductionLineStop,
          totalExcessFreight: monthlyStats.totalExcessFreight,
          gangshanMonths: monthlyStats.gangshanMonths,
          suzhouMonths: monthlyStats.suzhouMonths,
          monthlyReports: monthlyReports.map(report => ({
            month: report.month,
            factory: report.factory,
            assessmentScore: report.assessmentScore,
            shipmentQuantity: report.shipmentQuantity,
            receivedBatches: report.receivedBatches,
            totalComplaintCCR: report.totalComplaintCCR,
            lateDelivery: report.lateDelivery,
            specialApproval: report.specialApproval,
            productionLineStop: report.productionLineStop,
            excessFreight: report.excessFreight
          }))
        }
      }
      
      yearlyEvaluations.push(yearlyEvaluation)
    }
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    logger.info(`✅ OSAT ${year}年度評鑑彙整完成，共 ${yearlyEvaluations.length} 個供應商，耗時 ${processingTime}ms`)
    
    // 存儲到緩存
    cache.set(cacheKey, {
      data: yearlyEvaluations,
      timestamp: Date.now()
    });
    
    // 清理過期緩存
    for (const [key, value] of cache.entries()) {
      if ((Date.now() - value.timestamp) > CACHE_TTL) {
        cache.delete(key);
      }
    }
    
    // 添加性能監控頭部
    res.set('X-Processing-Time', processingTime.toString());
    res.set('X-Total-Vendors', yearlyEvaluations.length.toString());
    res.set('X-Total-Monthly-Reports', allMonthlyReports.length.toString());
    res.set('X-Cache-Status', 'MISS');
    
    res.json(yearlyEvaluations)
    
  } catch (e) {
    logger.error('OSAT年度評鑑彙整錯誤:', e)
    res.status(500).json({ error: 'server_error', details: e.message })
  }
})

app.put('/api/admin/users/:id', auth(), async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' })
  const id = Number(req.params.id)
  const schema = z.object({ role: z.enum(['viewer','quality_yearly_editor','purchase_editor','admin']).optional(), enabled: z.boolean().optional(), password: z.string().min(6).optional() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
  try {
    const data = { ...parsed.data }
    if (data.password) { data.password = await bcrypt.hash(data.password, 10) }
    const user = await prisma.user.update({ where: { id }, data })
    res.json({ id: user.id, username: user.username, role: user.role, enabled: user.enabled })
  } catch (e) {
    return res.status(500).json({ error: 'server_error' })
  }
})



const PORT = Number(process.env.PORT || 3006)
// 供應商驗證功能
async function validateVendors(vendorNames, systemType = 'osat') {
  if (maintenanceMode || !prisma) {
    return { valid: true, invalidVendors: [], message: '維護模式：跳過供應商驗證' };
  }
  
  try {
    const tableName = systemType === 'osat' ? 'oSATVendor' : 'sQMVQMVendor';
    const existingVendors = await prisma[tableName].findMany({
      select: { name: true }
    });
    
    const existingVendorNames = existingVendors.map(v => v.name);
    const invalidVendors = vendorNames.filter(name => !existingVendorNames.includes(name));
    
    return {
      valid: invalidVendors.length === 0,
      invalidVendors,
      existingVendors: existingVendorNames,
      message: invalidVendors.length > 0 
        ? `以下供應商名稱不存在於資料庫中：${invalidVendors.join(', ')}`
        : '所有供應商名稱驗證通過'
    };
  } catch (error) {
    logger.info('供應商驗證錯誤:', error.message);
    return { valid: false, invalidVendors: [], message: '供應商驗證失敗' };
  }
}

// 供應商驗證API
app.post('/api/validate/vendors', async (req, res) => {
  const { vendorNames, systemType } = req.body;
  
  if (!vendorNames || !Array.isArray(vendorNames)) {
    return res.status(400).json({ error: '無效的供應商名稱列表' });
  }
  
  const result = await validateVendors(vendorNames, systemType || 'osat');
  res.json(result);
});

// 供應商管理API
app.get('/api/admin/osat-vendors', auth(), async (req, res) => {
  logger.debug('🔍 OSAT供應商列表請求 - 用戶角色:', req.user?.role);
  if (!roleAllowed(req.user.role, ['admin', 'quality_yearly_editor'])) {
    logger.warn('❌ 權限檢查失敗 - 用戶角色:', req.user?.role, '允許的角色:', ['admin', 'quality_yearly_editor']);
    return res.status(403).json({ error: 'forbidden' });
  }
  
  if (maintenanceMode || !prisma) {
    return res.json([]);
  }
  
  try {
    const vendors = await prisma.oSATVendor.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(vendors);
  } catch (error) {
    logger.info('獲取OSAT供應商列表錯誤:', error.message);
    res.status(500).json({ error: '獲取供應商列表失敗' });
  }
});

app.get('/api/admin/sqm-vqm-vendors', auth(), async (req, res) => {
  logger.debug('🔍 SQM/VQM供應商列表請求 - 用戶角色:', req.user?.role);
  if (!roleAllowed(req.user.role, ['admin', 'quality_yearly_editor'])) {
    logger.warn('❌ 權限檢查失敗 - 用戶角色:', req.user?.role, '允許的角色:', ['admin', 'quality_yearly_editor']);
    return res.status(403).json({ error: 'forbidden' });
  }
  
  if (maintenanceMode || !prisma) {
    return res.json([]);
  }
  
  try {
    const vendors = await prisma.sQMVQMVendor.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(vendors);
  } catch (error) {
    logger.info('獲取SQM/VQM供應商列表錯誤:', error.message);
    res.status(500).json({ error: '獲取供應商列表失敗' });
  }
});

app.post('/api/admin/osat-vendors', auth(), async (req, res) => {
  if (!roleAllowed(req.user.role, ['admin', 'quality_yearly_editor'])) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  if (maintenanceMode || !prisma) {
    return res.status(503).json({ error: '維護模式：無法添加供應商' });
  }
  
  const { name } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '供應商名稱不能為空' });
  }
  
  try {
    const vendor = await prisma.oSATVendor.create({
      data: {
        name: name.trim()
      }
    });
    res.json(vendor);
  } catch (error) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: '供應商名稱已存在' });
    } else {
      logger.info('添加OSAT供應商錯誤:', error.message);
      res.status(500).json({ error: '添加供應商失敗' });
    }
  }
});

// 清空OSAT資料表的API端點（僅供管理員使用）
app.delete('/api/admin/clear-osat-tables', auth(), async (req, res) => {
  // 只允許 admin 操作
  if (!roleAllowed(req.user.role, ['admin'])) {
    return res.status(403).json({ error: 'forbidden' })
  }
  
  try {
    logger.info('🔄 開始清空OSAT資料表...');
    
    // 清空OSATAnnualInput資料表
    const annualResult = await prisma.oSATAnnualInput.deleteMany({});
    logger.info(`✅ 已清空OSATAnnualInput資料表，刪除了 ${annualResult.count} 筆記錄`);
    
    // 清空OSATMonthlyReport資料表
    const monthlyResult = await prisma.oSATMonthlyReport.deleteMany({});
    logger.info(`✅ 已清空OSATMonthlyReport資料表，刪除了 ${monthlyResult.count} 筆記錄`);
    
    // 清空OSATMonthlyPurchase資料表
    const purchaseResult = await prisma.oSATMonthlyPurchase.deleteMany({});
    logger.info(`✅ 已清空OSATMonthlyPurchase資料表，刪除了 ${purchaseResult.count} 筆記錄`);
    
    // 檢查剩餘記錄
    const remainingAnnual = await prisma.oSATAnnualInput.count();
    const remainingMonthly = await prisma.oSATMonthlyReport.count();
    const remainingPurchase = await prisma.oSATMonthlyPurchase.count();
    
    logger.debug('📊 清空結果:');
    logger.info(`  - OSATAnnualInput 剩餘記錄: ${remainingAnnual}`);
    logger.info(`  - OSATMonthlyReport 剩餘記錄: ${remainingMonthly}`);
    logger.info(`  - OSATMonthlyPurchase 剩餘記錄: ${remainingPurchase}`);
    
    res.json({
      ok: true,
      message: 'OSAT資料表已成功清空',
      deletedRecords: {
        annualInput: annualResult.count,
        monthlyReport: monthlyResult.count,
        monthlyPurchase: purchaseResult.count
      },
      remainingRecords: {
        annualInput: remainingAnnual,
        monthlyReport: remainingMonthly,
        monthlyPurchase: remainingPurchase
      }
    });
    
  } catch (error) {
    logger.error('❌ 清空資料表時發生錯誤:', error);
    res.status(500).json({ 
      error: 'server_error', 
      details: error.message 
    });
  }
});

// ========== 可用年份查詢API ==========

// 獲取SQM/VQM系統可用的年份（從資料庫查詢）
app.get('/api/available-years/sqm-vqm', auth(), async (req, res) => {
  if (maintenanceMode || !prisma) {
    return res.json([]);
  }
  
  try {
    // 查詢所有不重複的年份（使用 findMany 然後提取唯一值）
    const [monthlyReports, annualInputs] = await Promise.all([
      prisma.sQMVQMMonthlyReport.findMany({
        select: { year: true }
      }),
      prisma.sQMVQMAnnualInput.findMany({
        select: { year: true }
      })
    ]);
    
    // 合併並去重年份
    const yearsSet = new Set();
    monthlyReports.forEach(item => yearsSet.add(item.year));
    annualInputs.forEach(item => yearsSet.add(item.year));
    
    const years = Array.from(yearsSet).sort((a, b) => b - a); // 降序排列
    
    res.json(years.map(year => String(year)));
  } catch (error) {
    logger.error('獲取SQM/VQM可用年份失敗:', error);
    res.status(500).json({ error: '獲取年份失敗' });
  }
});

// 獲取OSAT系統可用的年份（從資料庫查詢）
app.get('/api/available-years/osat', auth(), async (req, res) => {
  if (maintenanceMode || !prisma) {
    return res.json([]);
  }
  
  try {
    // 查詢所有不重複的年份（使用 findMany 然後提取唯一值）
    const [monthlyReports, annualInputs, monthlyPurchases] = await Promise.all([
      prisma.oSATMonthlyReport.findMany({
        select: { year: true }
      }),
      prisma.oSATAnnualInput.findMany({
        select: { year: true }
      }),
      prisma.oSATMonthlyPurchase.findMany({
        select: { year: true }
      })
    ]);
    
    // 合併並去重年份
    const yearsSet = new Set();
    monthlyReports.forEach(item => yearsSet.add(item.year));
    annualInputs.forEach(item => yearsSet.add(item.year));
    monthlyPurchases.forEach(item => yearsSet.add(item.year));
    
    const years = Array.from(yearsSet).sort((a, b) => b - a); // 降序排列
    
    res.json(years.map(year => String(year)));
  } catch (error) {
    logger.error('獲取OSAT可用年份失敗:', error);
    res.status(500).json({ error: '獲取年份失敗' });
  }
});

// ========== OSAT到貨明細合併API ==========

// 獲取供應商映射規則
app.get('/api/osat/arrival/supplier-mapping', auth(), async (req, res) => {
  if (maintenanceMode || !prisma) {
    return res.json([]);
  }
  
  try {
    const mappings = await prisma.oSATSupplierMapping.findMany({
      where: { is_active: true },
      orderBy: { keyword: 'asc' }
    });
    res.json(mappings);
  } catch (error) {
    logger.error('獲取供應商映射規則失敗:', error);
    res.status(500).json({ error: '獲取規則失敗' });
  }
});

// 新增供應商映射規則
app.post('/api/osat/arrival/supplier-mapping', auth(), async (req, res) => {
  if (!roleAllowed(req.user.role, ['admin', 'quality_yearly_editor', 'purchase_editor'])) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  if (maintenanceMode || !prisma) {
    return res.status(503).json({ error: '維護模式：無法新增規則' });
  }
  
  const { keyword, supplier_name, rule_type = 'general', special_config = null } = req.body;
  
  if (!keyword || !supplier_name) {
    return res.status(400).json({ error: '關鍵字和供應商名稱不能為空' });
  }
  
  try {
    // 檢查關鍵字是否已存在
    const existing = await prisma.oSATSupplierMapping.findUnique({
      where: { keyword }
    });
    
    if (existing) {
      return res.status(400).json({ error: '關鍵字已存在' });
    }
    
    const newMapping = await prisma.oSATSupplierMapping.create({
      data: {
        keyword,
        supplier_name,
        rule_type,
        special_config,
        is_active: true
      }
    });
    
    res.json({ success: true, data: newMapping });
  } catch (error) {
    logger.error('新增供應商映射規則失敗:', error);
    res.status(500).json({ error: '新增規則失敗' });
  }
});

// 更新供應商映射規則
app.put('/api/osat/arrival/supplier-mapping/:id', auth(), async (req, res) => {
  if (!roleAllowed(req.user.role, ['admin', 'quality_yearly_editor', 'purchase_editor'])) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  if (maintenanceMode || !prisma) {
    return res.status(503).json({ error: '維護模式：無法更新規則' });
  }
  
  const id = Number(req.params.id);
  const { supplier_name, rule_type, special_config, is_active } = req.body;
  
  try {
    const updatedMapping = await prisma.oSATSupplierMapping.update({
      where: { id },
      data: {
        ...(supplier_name && { supplier_name }),
        ...(rule_type && { rule_type }),
        ...(special_config !== undefined && { special_config }),
        ...(is_active !== undefined && { is_active })
      }
    });
    
    res.json({ success: true, data: updatedMapping });
  } catch (error) {
    logger.error('更新供應商映射規則失敗:', error);
    res.status(500).json({ error: '更新規則失敗' });
  }
});

// 刪除供應商映射規則
app.delete('/api/osat/arrival/supplier-mapping/:id', auth(), async (req, res) => {
  if (!roleAllowed(req.user.role, ['admin'])) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  if (maintenanceMode || !prisma) {
    return res.status(503).json({ error: '維護模式：無法刪除規則' });
  }
  
  const id = Number(req.params.id);
  
  try {
    await prisma.oSATSupplierMapping.delete({
      where: { id }
    });
    
    res.json({ success: true, message: '規則刪除成功' });
  } catch (error) {
    logger.error('刪除供應商映射規則失敗:', error);
    res.status(500).json({ error: '刪除規則失敗' });
  }
});

// 處理到貨明細檔案上傳和合併
app.post('/api/osat/arrival/process', auth(), upload.array('files'), async (req, res) => {
  if (!roleAllowed(req.user.role, ['admin', 'quality_yearly_editor', 'purchase_editor'])) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  if (maintenanceMode || !prisma) {
    return res.status(503).json({ error: '維護模式：無法處理檔案' });
  }
  
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: '沒有選擇檔案' });
    }

    // 獲取供應商映射規則
    const supplierMappings = await prisma.oSATSupplierMapping.findMany({
      where: { is_active: true }
    });

    const supplierMapping = {};
    supplierMappings.forEach(mapping => {
      let specialConfig = mapping.special_config || null;
      // 如果 special_config 是 JSON 字符串，解析它
      if (specialConfig && typeof specialConfig === 'string') {
        try {
          specialConfig = JSON.parse(specialConfig);
        } catch (e) {
          logger.warn(`無法解析 special_config for keyword ${mapping.keyword}:`, e);
          specialConfig = null;
        }
      }
      supplierMapping[mapping.keyword] = {
        supplier_name: mapping.supplier_name,
        rule_type: mapping.rule_type || 'general',
        special_config: specialConfig,
      };
    });

    // 處理檔案
    const allData = [];
    const processedFiles = [];
    const failedFiles = [];
    const errorMessages = [];
    const supplierStats = {};
    const unknownSupplierFiles = [];
    const fileDetails = [];

    const normalize = (s) => {
      return String(s || '')
        .trim()
        .toUpperCase()
        .replace(/\.[^.]+$/, '') // 去掉副檔名
        .replace(/[^0-9A-Z\u4E00-\u9FFF]+/g, '') // 僅保留數字、A-Z、中文，去除各種分隔符與符號
    };

    // 嘗試修正檔名亂碼（UTF-8 被當作 Latin-1 顯示）
    const fixMojibake = (name) => {
      const str = String(name || '');
      const hasCJK = /[\u4E00-\u9FFF]/.test(str);
      const looksMojibake = /[ÃÂåäæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(str);
      if (!hasCJK && looksMojibake) {
        try {
          return Buffer.from(str, 'latin1').toString('utf8');
        } catch {
          return str;
        }
      }
      return str;
    };

    for (const file of files) {
      try {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });

        // 欄位別名與標準化（大小寫/符號不敏感）
        const normalizeHeader = (s) => String(s || '')
          .trim()
          .toUpperCase()
          .replace(/[^0-9A-Z\u4E00-\u9FFF]+/g, '');
        const headerAliases = {
          DEVICE: ['DEVICE', 'PARTNO', 'PART', 'PN', '料號', '產品', '產品型號'],
          DATECODE: ['DATECODE', 'DATE', 'DC', '生產日期', '日期'],
          LOTNO: ['LOTNO', 'LOT', 'LOTNO.', 'LOT#', '批號', '批次', '批次號'],
          'QTY (KPCS)': ['QTY (KPCS)', 'QTY(KPCS)', 'QTY', 'QUANTITY', 'QTY(K)', '數量', '數量K', '數量(KPCS)'],
          Po: ['PO', 'PO#', 'PO #', 'P/O', 'PONO', 'P.O.', '採購單', '採購單號'],
          '工單': ['工單', '工單號', 'WO', 'WORKORDER'],
          '備註': ['備註', 'REMARK', 'REMARKS', 'NOTE']
        };
        const aliasToStandard = new Map();
        for (const [std, list] of Object.entries(headerAliases)) {
          for (const name of list) aliasToStandard.set(normalizeHeader(name), std);
        }

        // 先從檔名識別供應商（強化匹配）
        let supplier = '未知供應商';
        let matchedKeyword = '';
        let specialConfig = null;
        const originalName = file.originalname;
        const decodedName = fixMojibake(originalName);
        const normalizedFilename = normalize(decodedName);
        for (const [rawKeyword, mapping] of Object.entries(supplierMapping)) {
          if (!rawKeyword) continue;
          const pieces = String(rawKeyword).split(/[;,，；]/).map(k => k.trim()).filter(Boolean);
          for (const piece of pieces) {
            const normalizedKeyword = normalize(piece);
            if (normalizedKeyword && normalizedFilename.includes(normalizedKeyword)) {
              supplier = mapping.supplier_name;
              matchedKeyword = piece;
              if (mapping.rule_type === 'special') specialConfig = mapping.special_config || null;
              break;
            }
          }
          if (supplier !== '未知供應商') break;
        }

        // 選擇工作表：特規優先
        const defaultSheetName = workbook.SheetNames[0];
        const useSheetName = (specialConfig && specialConfig.sheet_name && workbook.Sheets[specialConfig.sheet_name])
          ? specialConfig.sheet_name
          : defaultSheetName;
        const worksheet = workbook.Sheets[useSheetName];

        // 以表頭列方式讀取，確保空值欄位也會存在
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        if (!rows || rows.length === 0) {
          failedFiles.push(file.originalname);
          errorMessages.push(`${file.originalname}: 檔案為空或無法讀取`);
          continue;
        }

        const rawHeaders = rows[0] || [];
        const headerMap = new Map(); // index -> standard header name
        const stdToIndices = new Map(); // standard header name -> array of indices
        
        rawHeaders.forEach((h, idx) => {
          let std = null;
          // 特規欄位映射優先（優先於一般別名映射）
          if (specialConfig && specialConfig.field_mapping) {
            const fmKeys = Object.keys(specialConfig.field_mapping);
            const matched = fmKeys.find(k => normalizeHeader(k) === normalizeHeader(h));
            if (matched) {
              const target = specialConfig.field_mapping[matched];
              const targetStd = aliasToStandard.get(normalizeHeader(target)) || target;
              std = targetStd;
            }
          }
          // 如果特規映射未找到，使用一般別名映射
          if (!std) {
            std = aliasToStandard.get(normalizeHeader(h));
          }
          if (std) {
            headerMap.set(idx, std);
            // 記錄所有映射到同一個標準欄位的索引
            if (!stdToIndices.has(std)) {
              stdToIndices.set(std, []);
            }
            stdToIndices.get(std).push(idx);
          }
        });

        // 驗證必要欄位是否存在於表頭（而不是看資料列是否有值）
        const requiredColumns = ['Device', 'Date Code', 'LOTNO', 'QTY (Kpcs)'];
        const stdToCanonical = {
          'Device': 'DEVICE',
          'Date Code': 'DATECODE',
          'LOTNO': 'LOTNO',
          'QTY (Kpcs)': 'QTY (KPCS)'
        };
        const presentStandards = new Set(Array.from(headerMap.values()));
        // 若特規指定 required_columns（原始表頭），先驗證原始表頭
        if (specialConfig && Array.isArray(specialConfig.required_columns) && specialConfig.required_columns.length > 0) {
          const normHeaderSet = new Set(rawHeaders.map(h => normalizeHeader(h)));
          const missingOrig = specialConfig.required_columns.filter(k => !normHeaderSet.has(normalizeHeader(k)));
          if (missingOrig.length > 0) {
            failedFiles.push(file.originalname);
            errorMessages.push(`${file.originalname}: 缺少欄位 ${missingOrig.join(', ')}`);
            continue;
          }
        }
        const missingColumns = requiredColumns.filter(col => !presentStandards.has(stdToCanonical[col]));
        if (missingColumns.length > 0) {
          failedFiles.push(file.originalname);
          errorMessages.push(`${file.originalname}: 缺少欄位 ${missingColumns.join(', ')}`);
          continue;
        }

        // 轉回物件列，使用標準欄位名（空值也會保留）
        // 當有多個欄位映射到同一個標準欄位時，優先選擇第一個有值的
        const standardizedRows = rows.slice(1).map((arr) => {
          const obj = {};
          stdToIndices.forEach((indices, stdName) => {
            // 如果有多個索引映射到同一個標準欄位，選擇第一個有值的
            let value = '';
            for (const idx of indices) {
              const cellValue = arr[idx];
              if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
                value = String(cellValue);
                break; // 找到第一個有值的就停止
              }
            }
            // 如果所有索引都是空的，使用第一個索引的值（空字串）
            if (value === '' && indices.length > 0) {
              value = arr[indices[0]] ?? '';
            }
            obj[stdName] = value;
          });
          // 特規：數量單位換算
          if (specialConfig && specialConfig.quantity_divide && obj['QTY (KPCS)']) {
            const num = parseFloat(String(obj['QTY (KPCS)']).toString().replace(/[\s,]/g, ''));
            if (!isNaN(num)) obj['QTY (KPCS)'] = num / Number(specialConfig.quantity_divide);
          }
          // 特規：依工單內容覆蓋供應商
          if (specialConfig && Array.isArray(specialConfig.supplier_rules)) {
            // 嘗試多個可能的欄位名稱
            const poRaw = obj['工單'] ?? obj['Po'] ?? obj['PO'] ?? '';
            const poText = String(poRaw).trim();
            const poNorm = poText.toUpperCase();
            let matched = false;
            for (const rule of specialConfig.supplier_rules) {
              if (!rule || typeof rule.condition !== 'string') continue;
              // 支持多種條件格式：'PO # contains FA', 'contains FA', 'FA'
              let needle = '';
              const m1 = rule.condition.match(/contains\s+(.*)$/i);
              const m2 = rule.condition.match(/^(.+)$/);
              if (m1) {
                needle = m1[1].trim();
              } else if (m2) {
                needle = m2[1].trim();
              }
              if (!needle) continue;
              const needleNorm = needle.toUpperCase();
              if (poNorm && poNorm.includes(needleNorm)) {
                obj.__overrideSupplier = rule.supplier || obj.__overrideSupplier;
                matched = true;
                break; // 第一個匹配的規則生效
              }
            }
            // 如果沒有任何規則匹配，且設定了 default_supplier，則使用它
            if (!matched && specialConfig.default_supplier) {
              obj.__overrideSupplier = specialConfig.default_supplier;
            }
          }
          return obj;
        });

        // 向上填充空值：如果某個欄位是空值，往上找同一欄位的值填入
        // 只針對以下四個欄位進行向上填充：工單、Po、Device、Date Code
        // 使用標準化後的欄位名稱（對應 headerAliases 的 key）
        const fillableFields = ['工單', 'Po', 'DEVICE', 'DATECODE'];
        
        for (let i = 0; i < standardizedRows.length; i++) {
          const currentRow = standardizedRows[i];
          for (const field of fillableFields) {
            // 如果當前欄位是空的，往上找
            const currentValue = currentRow[field];
            if (currentValue === undefined || currentValue === null || currentValue === '') {
              // 往上查找，從上一行開始
              for (let j = i - 1; j >= 0; j--) {
                const previousRow = standardizedRows[j];
                const previousValue = previousRow[field];
                // 如果找到有值的欄位，填入並停止查找
                if (previousValue !== undefined && previousValue !== null && previousValue !== '') {
                  currentRow[field] = previousValue;
                  break;
                }
              }
            }
          }
        }

        // rows 已於前面檢查是否為空

        // 檢查必要欄位
        // 上面已檢查表頭存在，這裡不再因空值而判缺
        
        // 先前已完成檔名供應商比對與 specialConfig 設定
        if (supplier === '未知供應商') {
          unknownSupplierFiles.push(file.originalname);
        }

        // 處理資料：遇到 TOTAL 時停止（而不是過濾）
        const processedRows = [];
        for (const row of standardizedRows) {
          const lotno = String(row['LOTNO'] ?? '').trim().toUpperCase();
          if (lotno === 'TOTAL') {
            break; // 遇到 TOTAL 時停止處理
          }
          processedRows.push(row);
        }

        const processedData = processedRows.map(row => ({
            '到貨日期': extractDateFromFilename(decodedName),
            '供應商': row.__overrideSupplier || supplier || (specialConfig && specialConfig.default_supplier) || '未知供應商',
            '工單': row['工單'] ?? '',
            'Po': row['Po'] ?? row['PO'] ?? row['P/O'] ?? '',
            'Device': row['Device'] ?? row['DEVICE'] ?? '',
            'Date Code': row['Date Code'] ?? row['DATECODE'] ?? '',
            'LOTNO': row['LOTNO'] ?? '',
            'QTY (Kpcs)': row['QTY (Kpcs)'] ?? row['QTY (KPCS)'] ?? row['QTY'] ?? '',
            '備註': row['備註'] ?? row['REMARK'] ?? row['REMARKS'] ?? row['NOTE'] ?? ''
          }));

        allData.push(...processedData);
        processedFiles.push(file.originalname);

        // 統計供應商資料（使用實際資料行中的供應商）
        processedData.forEach(row => {
          const actualSupplier = row['供應商'] || '未知供應商';
          supplierStats[actualSupplier] = (supplierStats[actualSupplier] || 0) + 1;
        });

        // 檔案詳情（含除錯資訊）
        const sampleRow = standardizedRows.length > 0 ? standardizedRows[0] : null;
        const samplePoValue = sampleRow ? (sampleRow['工單'] ?? sampleRow['Po'] ?? sampleRow['PO'] ?? '') : '';
        const overrideSupplierSample = sampleRow ? sampleRow.__overrideSupplier : null;
        
        // 計算所有不同的供應商
        const supplierCounts = {};
        const uniqueSuppliers = new Set();
        processedData.forEach(row => {
          const actualSupplier = row['供應商'] || '未知供應商';
          supplierCounts[actualSupplier] = (supplierCounts[actualSupplier] || 0) + 1;
          uniqueSuppliers.add(actualSupplier);
        });
        const mostCommonSupplier = Object.keys(supplierCounts).length > 0 
          ? Object.keys(supplierCounts).reduce((a, b) => 
              supplierCounts[a] > supplierCounts[b] ? a : b)
          : '未知供應商';
        
        // 如果有特殊處理且有多個不同供應商，則記錄所有供應商
        const allSuppliers = Array.from(uniqueSuppliers);
        const hasMultipleSuppliers = allSuppliers.length > 1;
        const hasSpecialConfig = Boolean(specialConfig);
        
        // 排序供應商（按出現次數降序，然後按字母順序）
        const sortedSuppliers = allSuppliers.sort((a, b) => {
          const countDiff = supplierCounts[b] - supplierCounts[a];
          if (countDiff !== 0) return countDiff;
          return a.localeCompare(b);
        });
        
        // 如果有特殊處理且有多個不同供應商，則顯示所有供應商
        const supplierForDisplay = (hasSpecialConfig && hasMultipleSuppliers)
          ? sortedSuppliers.join(', ')
          : (processedData.length > 0 ? mostCommonSupplier : supplier);
        
        fileDetails.push({
          filename: originalName,
          supplier: supplierForDisplay, // 特殊處理時可能包含多個供應商（用逗號分隔）
          is_unknown: supplierForDisplay === '未知供應商' || allSuppliers.every(s => s === '未知供應商'),
          _debug: {
            normalizedFilename,
            matchedKeyword,
            decodedName,
            specialApplied: hasSpecialConfig,
            specialSheet: (specialConfig && specialConfig.sheet_name) ? specialConfig.sheet_name : null,
            samplePoValue: String(samplePoValue),
            overrideSupplierSample: overrideSupplierSample || null,
            hasSupplierRules: (specialConfig && Array.isArray(specialConfig.supplier_rules) && specialConfig.supplier_rules.length > 0) || false,
            defaultSupplier: (specialConfig && specialConfig.default_supplier) || null,
            allSuppliers: sortedSuppliers, // 調試：所有供應商列表
            supplierCount: allSuppliers.length, // 調試：供應商數量
            hasMultipleSuppliers: hasMultipleSuppliers // 調試：是否有多個供應商
          }
        });

      } catch (error) {
        failedFiles.push(file.originalname);
        errorMessages.push(`${file.originalname}: ${error.message}`);
      }
    }

    if (allData.length === 0) {
      return res.json({
        success: false,
        message: '沒有成功處理任何檔案',
        details: {
          processed_files: processedFiles.length,
          failed_files: failedFiles.length,
          total_rows: 0,
          error_messages: errorMessages,
          unknown_supplier_files: unknownSupplierFiles,
          supplier_stats: supplierStats
        }
      });
    }

    // 生成 Excel 檔案
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(allData);
    XLSX.utils.book_append_sheet(workbook, worksheet, '合併結果');

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const fileContent = excelBuffer.toString('base64');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const downloadFile = `OSAT到貨明細合併結果_${timestamp}.xlsx`;

    res.json({
      success: true,
      message: `成功處理 ${processedFiles.length} 個檔案，共 ${allData.length} 筆資料`,
      download_file: downloadFile,
      file_content: fileContent,
      details: {
        processed_files: processedFiles.length,
        failed_files: failedFiles.length,
        total_rows: allData.length,
        error_messages: errorMessages,
        unknown_supplier_files: unknownSupplierFiles,
        supplier_stats: supplierStats,
        file_details: fileDetails
      }
    });

  } catch (error) {
    logger.error('處理到貨明細檔案失敗:', error);
    res.status(500).json({ 
      success: false, 
      message: `處理過程中發生錯誤: ${error.message}` 
    });
  }
});

// 輔助函數：從檔名提取日期
function extractDateFromFilename(filename) {
  const match = filename.match(/^(\d{2})(\d{2})/);
  if (match) {
    const month = parseInt(match[1]);
    const day = parseInt(match[2]);
    const year = new Date().getFullYear();
    return `${year}/${month}/${day}`;
  }
  return '';
}

// 輔助函數：從檔名識別供應商
function getSupplierFromFilename(filename, supplierMapping) {
  const normalize = (s) => String(s || '').trim().toUpperCase().replace(/\.[^.]+$/, '').replace(/[^0-9A-Z\u4E00-\u9FFF]+/g, '');
  const normalizedFilename = normalize(filename);
  for (const [rawKeyword, supplierName] of Object.entries(supplierMapping)) {
    if (!rawKeyword) continue;
    const pieces = String(rawKeyword).split(/[;,，；]/).map(k => k.trim()).filter(Boolean);
    for (const piece of pieces) {
      const normalizedKeyword = normalize(piece);
      if (normalizedKeyword && normalizedFilename.includes(normalizedKeyword)) {
        return supplierName;
      }
    }
  }
  return '未知供應商';
}

app.post('/api/admin/sqm-vqm-vendors', auth(), async (req, res) => {
  if (!roleAllowed(req.user.role, ['admin', 'quality_yearly_editor'])) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  if (maintenanceMode || !prisma) {
    return res.status(503).json({ error: '維護模式：無法添加供應商' });
  }
  
  const { name, vendorType, supplierCode, materialCategory, region, isAU } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '供應商名稱不能為空' });
  }

  try {
    // 供应商类型：优先取前端传来的 region（新规范），否则回落 vendorType
    const finalRegion = normalizeSupplierType(region || vendorType);
    const vendor = await prisma.sQMVQMVendor.create({
      data: {
        name: name.trim(),
        vendorType: finalRegion, // 向后兼容同步写入
        supplierCode: supplierCode?.toString().trim() || null,
        materialCategory: materialCategory?.toString().trim() || null,
        region: finalRegion,
        isAU: cleanIsAU(isAU)
      }
    });
    res.json(vendor);
  } catch (error) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: '供應商名稱已存在' });
    } else {
      logger.info('添加SQM/VQM供應商錯誤:', error.message);
      res.status(500).json({ error: '添加供應商失敗' });
    }
  }
});

// 更新 SQM/VQM 供應商資料
app.put('/api/admin/sqm-vqm-vendors/:id', auth(), async (req, res) => {
  if (!roleAllowed(req.user.role, ['admin', 'quality_yearly_editor'])) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  if (maintenanceMode || !prisma) {
    return res.status(503).json({ error: '維護模式：無法修改供應商' });
  }
  
  const vendorId = parseInt(req.params.id);
  const { vendorType, supplierCode, materialCategory, region, isAU } = req.body;

  if (!vendorId || isNaN(vendorId)) {
    return res.status(400).json({ error: '無效的供應商 ID' });
  }
  
  try {
    const existingVendor = await prisma.sQMVQMVendor.findUnique({
      where: { id: vendorId }
    });
    
    if (!existingVendor) {
      return res.status(404).json({ error: '供應商不存在' });
    }
    
    const updateData = {};
    // 供应商类型：优先取前端传来的 region（新规范），否则回落 vendorType
    const typeSource = region !== undefined && region !== null ? region : vendorType;
    if (typeSource !== undefined && typeSource !== null) {
      const finalRegion = normalizeSupplierType(typeSource);
      updateData.region = finalRegion;
      updateData.vendorType = finalRegion; // 保持 vendorType 同步，向后兼容
    }
    if (supplierCode !== undefined) {
      updateData.supplierCode = supplierCode?.toString().trim() || null;
    }
    if (materialCategory !== undefined) {
      updateData.materialCategory = materialCategory?.toString().trim() || null;
    }
    if (isAU !== undefined) {
      updateData.isAU = cleanIsAU(isAU);
    }

    const updatedVendor = await prisma.sQMVQMVendor.update({
      where: { id: vendorId },
      data: updateData
    });
    
    res.json(updatedVendor);
  } catch (error) {
    logger.info('更新SQM/VQM供應商錯誤:', error.message);
    res.status(500).json({ error: '更新供應商失敗' });
  }
});

app.post('/api/admin/sqm-vqm-vendors/batch', auth(), async (req, res) => {
  if (!roleAllowed(req.user.role, ['admin', 'quality_yearly_editor'])) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  if (maintenanceMode || !prisma) {
    return res.status(503).json({ error: '維護模式：無法添加供應商' });
  }
  
  const { vendors } = req.body;
  
  if (!Array.isArray(vendors) || vendors.length === 0) {
    return res.status(400).json({ error: '請提供供應商數據' });
  }
  
  const results = {
    success: [],
    failed: [],
    skipped: []
  };
  
  for (const vendorData of vendors) {
    const { name, vendorType, supplierCode, materialCategory, region, isAU } = vendorData;

    if (!name || typeof name !== 'string') {
      results.failed.push({ name: name || '未知', reason: '供應商名稱無效' });
      continue;
    }
    
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      results.failed.push({ name: name || '未知', reason: '供應商名稱為空' });
      continue;
    }
    
    // 供应商类型归一化：优先 region，其次 vendorType，默认「国内」
    const finalRegion = normalizeSupplierType(region || vendorType);

    try {
      const existingVendor = await prisma.sQMVQMVendor.findUnique({
        where: { name: trimmedName }
      });

      if (existingVendor) {
        // 已存在则更新其他字段（isAU 若未提供則保留原值）
        const updatedVendor = await prisma.sQMVQMVendor.update({
          where: { name: trimmedName },
          data: {
            supplierCode: supplierCode?.toString().trim() || existingVendor.supplierCode,
            materialCategory: materialCategory?.toString().trim() || existingVendor.materialCategory,
            region: finalRegion,
            vendorType: finalRegion,
            isAU: isAU !== undefined ? cleanIsAU(isAU) : existingVendor.isAU
          }
        });
        results.skipped.push({ name: trimmedName, reason: '供應商已存在，已更新其他欄位', id: updatedVendor.id });
        continue;
      }

      const createdVendor = await prisma.sQMVQMVendor.create({
        data: {
          name: trimmedName,
          vendorType: finalRegion,
          supplierCode: supplierCode?.toString().trim() || null,
          materialCategory: materialCategory?.toString().trim() || null,
          region: finalRegion,
          isAU: cleanIsAU(isAU)
        }
      });

      results.success.push({ name: trimmedName, id: createdVendor.id });
    } catch (error) {
      logger.info('批量添加SQM/VQM供應商錯誤:', error.message);
      results.failed.push({ name: trimmedName, reason: error.message });
    }
  }
  
  res.json({
    message: `批量導入完成：成功 ${results.success.length} 筆，跳過 ${results.skipped.length} 筆，失敗 ${results.failed.length} 筆`,
    ...results
  });
});

// 清空所有 SQM/VQM 供應商資料
app.delete('/api/admin/sqm-vqm-vendors/all', auth(), async (req, res) => {
  if (!roleAllowed(req.user.role, ['admin', 'quality_yearly_editor'])) {
    return res.status(403).json({ error: 'forbidden' });
  }

  if (maintenanceMode || !prisma) {
    return res.status(503).json({ error: '維護模式：無法清空供應商' });
  }

  try {
    // 1. 先删除月报和年度评鉴（外键关联）
    const monthlyResult = await prisma.sQMVQMMonthlyReport.deleteMany({});
    const annualResult = await prisma.sQMVQMAnnualInput.deleteMany({});
    // 2. 再删除供应商
    const vendorResult = await prisma.sQMVQMVendor.deleteMany({});
    logger.info(`清空供應商資料: 月報=${monthlyResult.count} 筆, 年度評鑑=${annualResult.count} 筆, 供應商=${vendorResult.count} 筆`);
    res.json({
      message: `已清空所有供應商資料 (供應商 ${vendorResult.count} 筆, 月報 ${monthlyResult.count} 筆, 年度評鑑 ${annualResult.count} 筆)`,
      count: vendorResult.count,
      monthlyCount: monthlyResult.count,
      annualCount: annualResult.count
    });
  } catch (error) {
    logger.error('清空SQM/VQM供應商錯誤:', error.message);
    res.status(500).json({ error: '清空供應商失敗：' + error.message });
  }
});

// 移除單一供應商（僅限管理員）。注意：須註冊在 /all 之後，避免 :id 攔截 /all
app.delete('/api/admin/sqm-vqm-vendors/:id', auth(), async (req, res) => {
  // 僅 admin 可移除供應商（quality_yearly_editor 不可）
  if (!roleAllowed(req.user.role, ['admin'])) {
    return res.status(403).json({ error: 'forbidden', message: '僅管理員可移除供應商' });
  }
  if (maintenanceMode || !prisma) {
    return res.status(503).json({ error: '維護模式：無法移除供應商' });
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: '無效的供應商ID' });
  }
  try {
    const vendor = await prisma.sQMVQMVendor.findUnique({ where: { id } });
    if (!vendor) {
      return res.status(404).json({ error: '供應商不存在' });
    }
    // 先刪除該供應商的季報與年度評鑑（外鍵關聯），再刪除供應商
    const monthlyResult = await prisma.sQMVQMMonthlyReport.deleteMany({ where: { vendorId: id } });
    const annualResult = await prisma.sQMVQMAnnualInput.deleteMany({ where: { vendorId: id } });
    await prisma.sQMVQMVendor.delete({ where: { id } });
    logger.info(`移除供應商: ${vendor.name} (id=${id})，連帶刪除季報 ${monthlyResult.count} 筆、年度評鑑 ${annualResult.count} 筆，操作者=${req.user?.username}`);
    res.json({
      message: `已移除供應商「${vendor.name}」（連帶刪除季報 ${monthlyResult.count} 筆、年度評鑑 ${annualResult.count} 筆）`,
      monthlyCount: monthlyResult.count,
      annualCount: annualResult.count
    });
  } catch (error) {
    logger.error('移除SQM/VQM供應商錯誤:', error.message);
    res.status(500).json({ error: '移除供應商失敗：' + error.message });
  }
});

// 維護模式下的API端點
if (maintenanceMode) {
  logger.info('🔧 啟用維護模式API端點');
  
  // 維護模式狀態檢查
  app.get('/api/maintenance/status', (req, res) => {
    res.json({ 
      maintenanceMode: true, 
      message: '系統維護中，部分功能可能受限',
      availableFeatures: ['login', 'view_reports']
    });
  });
  
  // 維護模式下的月報表數據（返回空數據）
  app.get('/api/osat/monthly/:year/:month', (req, res) => {
    res.json([]);
  });
  
  app.get('/api/sqm-vqm/monthly/:year/:month', (req, res) => {
    res.json([]);
  });
  
  // 維護模式下的年度評鑑數據（返回空數據）
  app.get('/api/osat/annual/:year', (req, res) => {
    res.json([]);
  });
  
  app.get('/api/sqm-vqm/annual/:year', (req, res) => {
    res.json([]);
  });
  
  // 維護模式下的用戶列表（返回預設用戶）
  app.get('/api/admin/users', auth(), (req, res) => {
    res.json([MAINTENANCE_DATA.users[0]]);
  });
  
  // 其他API返回維護模式消息
  app.use('/api', (req, res) => {
    res.status(503).json({
      error: 'maintenance_mode',
      message: '系統維護中，此功能暫時不可用'
    });
  });
}

// 配置靜態文件服務（用於生產環境）
const distPath = path.join(__dirname, '../../dist')
app.use(express.static(distPath))

// 所有非API請求都返回index.html（用於SPA路由）
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'))
  }
})

// 啟動服務器
async function startServer() {
  // 初始化數據庫連接
  maintenanceMode = await initializeDatabase();
  
  app.listen(PORT, async () => {
    if (maintenanceMode) {
      logger.info(`🔧 維護模式服務器運行在端口 ${PORT}`);
    } else {
      logger.info(`✅ 正常模式服務器運行在端口 ${PORT}`);
      await ensureAdminSeed();
      await ensureVendorColumns();
    }
  });
}

startServer().catch(err => logger.error('啟動失敗:', err));

