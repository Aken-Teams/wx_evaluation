import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { badRequest, notFound } from '../../lib/httpError';

const publicFields = {
  id: true,
  name: true,
  supplierCode: true,
  materialCategory: true,
  region: true,
  isAU: true,
  vendorType: true,
} as const;

export interface SupplierInput {
  name: string;
  supplierCode?: string | null;
  materialCategory?: string | null;
  region?: string | null;
  isAU?: string | null;
  vendorType?: string;
}

export const listSuppliers = () =>
  prisma.sQMVQMVendor.findMany({ orderBy: { name: 'asc' }, select: publicFields });

export const getSupplier = async (id: number) => {
  const vendor = await prisma.sQMVQMVendor.findUnique({ where: { id }, select: publicFields });
  if (!vendor) throw notFound('找不到该供应商');
  return vendor;
};

export const createSupplier = async (data: SupplierInput) => {
  try {
    return await prisma.sQMVQMVendor.create({
      data: { ...data, vendorType: data.vendorType ?? 'domestic' },
      select: publicFields,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      throw badRequest('供应商名称已存在');
    throw e;
  }
};

export const updateSupplier = async (id: number, data: SupplierInput) => {
  await getSupplier(id);
  try {
    return await prisma.sQMVQMVendor.update({ where: { id }, data, select: publicFields });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      throw badRequest('供应商名称已存在');
    throw e;
  }
};

export const deleteSupplier = async (id: number) => {
  await getSupplier(id);
  const reports = await prisma.sQMVQMMonthlyReport.count({ where: { vendorId: id } });
  if (reports > 0) throw badRequest(`该供应商已有 ${reports} 笔评比记录，无法删除`);
  await prisma.sQMVQMVendor.delete({ where: { id } });
  return { ok: true };
};

/** 批量匯入：以名稱為鍵 upsert，回傳新增/更新筆數 */
export const batchUpsert = async (items: SupplierInput[]) => {
  let created = 0;
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const existing = await tx.sQMVQMVendor.findUnique({ where: { name: item.name } });
      if (existing) {
        await tx.sQMVQMVendor.update({ where: { name: item.name }, data: item });
        updated += 1;
      } else {
        await tx.sQMVQMVendor.create({ data: { ...item, vendorType: item.vendorType ?? 'domestic' } });
        created += 1;
      }
    }
  });
  return { created, updated, total: items.length };
};
