import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as service from './sourcing.service';

export const sourcingRouter = Router();

const editor = requireRole('admin', 'quality_yearly_editor', 'purchase_editor');

/**
 * 檔名編碼修正：不同 multer/busboy 版本對非 ASCII 檔名的解碼不一致。
 * 若字串只含 latin1 擴充區（–ÿ）且無真正的高位 Unicode，代表是「被 latin1 誤讀的 UTF-8 位元組」，需轉回 UTF-8；
 * 若已含 CJK 等高位字元（>= Ā），代表已是正確 UTF-8，直接使用。
 */
const decodeFileName = (name: string): string =>
  /[-ÿ]/.test(name) && !/[Ā-￿]/.test(name)
    ? Buffer.from(name, 'latin1').toString('utf8')
    : name;

// 附件上傳（存磁碟；檔名以 UUID 避免碰撞，保留原副檔名）
service.ensureUploadDir();
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, service.uploadDir),
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname) || ''}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 }, // 單檔 20MB、一次最多 10 檔
});

const idParam = z.object({ id: z.coerce.number().int().positive() });
const eventSchema = z.object({
  title: z.string().min(1, '请输入案件名称'),
  itemName: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
});
const quoteSchema = z.object({
  supplierName: z.string().min(1, '请输入供方名称'),
  stage: z.enum(['before', 'after']).optional(),
  moldItems: z.string().nullable().optional(),
  products: z
    .array(
      z.object({
        name: z.string(),
        moldPrice: z.number().nullable().optional(),
        unitPrice: z.number().nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
  moldPriceTaxed: z.number().nullable().optional(),
  productUnitPrice: z.number().nullable().optional(),
  unitPriceTotal: z.number().nullable().optional(),
  tierUnitPrice: z.number().nullable().optional(),
  sampleLeadTime: z.string().nullable().optional(),
  deliveryCycle: z.string().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  moldPaymentTerms: z.string().nullable().optional(),
  priceTier: z.string().nullable().optional(),
  backgroundInfo: z.string().nullable().optional(),
  evaluation: z.string().nullable().optional(),
});

const h =
  (fn: (req: import('express').Request) => Promise<unknown>): import('express').RequestHandler =>
  async (req, res, next) => {
    try {
      res.json(await fn(req));
    } catch (e) {
      next(e);
    }
  };

sourcingRouter.use(authenticate);

// 案件
sourcingRouter.get('/events', h(() => service.listEvents()));
sourcingRouter.post('/events', editor, validate(eventSchema), h((req) => service.createEvent(req.body)));
sourcingRouter.get('/events/:id', validate(idParam, 'params'), h((req) => service.getEvent(Number(req.params.id))));
sourcingRouter.put('/events/:id', validate(idParam, 'params'), editor, validate(eventSchema), h((req) => service.updateEvent(Number(req.params.id), req.body)));
sourcingRouter.delete('/events/:id', validate(idParam, 'params'), editor, h((req) => service.deleteEvent(Number(req.params.id))));

// 報價
sourcingRouter.post('/events/:id/quotes', validate(idParam, 'params'), editor, validate(quoteSchema), h((req) => service.addQuote(Number(req.params.id), req.body)));
sourcingRouter.put('/quotes/:id', validate(idParam, 'params'), editor, h((req) => service.updateQuote(Number(req.params.id), req.body)));
sourcingRouter.delete('/quotes/:id', validate(idParam, 'params'), editor, h((req) => service.deleteQuote(Number(req.params.id))));
sourcingRouter.post('/quotes/:id/best', validate(idParam, 'params'), editor, h((req) => service.markBest(Number(req.params.id))));

// 報價單附件：上傳（多檔）/ 取檔（下載或預覽，前端以 blob 處理）/ 刪除
sourcingRouter.post(
  '/quotes/:id/attachments',
  validate(idParam, 'params'),
  editor,
  upload.array('files', 10),
  h((req) => {
    const files = ((req.files as Express.Multer.File[]) ?? []).map((f) => ({
      fileName: decodeFileName(f.originalname),
      storedName: f.filename,
      mime: f.mimetype,
      size: f.size,
    }));
    return service.addAttachments(Number(req.params.id), files);
  }),
);

sourcingRouter.get('/attachments/:id/file', validate(idParam, 'params'), async (req, res, next) => {
  try {
    const a = await service.getAttachment(Number(req.params.id));
    const full = path.join(service.uploadDir, a.storedName);
    if (!fs.existsSync(full)) {
      res.status(404).json({ error: '檔案不存在（可能已被移除）' });
      return;
    }
    res.setHeader('Content-Type', a.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(a.fileName)}`);
    fs.createReadStream(full).pipe(res);
  } catch (e) {
    next(e);
  }
});

sourcingRouter.delete('/attachments/:id', validate(idParam, 'params'), editor, h((req) => service.deleteAttachment(Number(req.params.id))));

// AI 建议最优一家
sourcingRouter.post('/events/:id/recommend', validate(idParam, 'params'), h((req) => service.recommend(Number(req.params.id))));
