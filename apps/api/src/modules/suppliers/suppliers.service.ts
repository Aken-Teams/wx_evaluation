import { prisma } from '../../db/prisma';
import { notFound } from '../../lib/httpError';

const publicFields = {
  id: true,
  name: true,
  supplierCode: true,
  materialCategory: true,
  region: true,
  isAU: true,
  vendorType: true,
} as const;

export const listSuppliers = () =>
  prisma.sQMVQMVendor.findMany({ orderBy: { name: 'asc' }, select: publicFields });

export const getSupplier = async (id: number) => {
  const vendor = await prisma.sQMVQMVendor.findUnique({ where: { id }, select: publicFields });
  if (!vendor) throw notFound('找不到該供應商');
  return vendor;
};
