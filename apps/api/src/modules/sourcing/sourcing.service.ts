import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { notFound } from '../../lib/httpError';

export const listEvents = () =>
  prisma.sourcingEvent.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { quotes: true } } },
  });

export const createEvent = (data: { title: string; itemName?: string | null; description?: string | null }) =>
  prisma.sourcingEvent.create({ data });

export const getEvent = async (id: number) => {
  const event = await prisma.sourcingEvent.findUnique({
    where: { id },
    include: { quotes: { orderBy: [{ supplierName: 'asc' }, { stage: 'asc' }] } },
  });
  if (!event) throw notFound('找不到该比价案件');
  return event;
};

export const updateEvent = async (
  id: number,
  data: { title?: string; itemName?: string | null; description?: string | null; status?: string },
) => {
  await getEvent(id);
  return prisma.sourcingEvent.update({ where: { id }, data });
};

export const deleteEvent = async (id: number) => {
  await getEvent(id);
  await prisma.$transaction([
    prisma.sourcingQuote.deleteMany({ where: { eventId: id } }),
    prisma.sourcingEvent.delete({ where: { id } }),
  ]);
  return { ok: true };
};

export interface QuoteProduct {
  name: string;
  moldPrice?: number | null;
  unitPrice?: number | null;
}

export type QuoteInput = {
  supplierName: string;
  stage?: string;
  moldItems?: string | null;
  products?: QuoteProduct[] | null;
  moldPriceTaxed?: number | null;
  productUnitPrice?: number | null;
  unitPriceTotal?: number | null;
  tierUnitPrice?: number | null;
  sampleLeadTime?: string | null;
  deliveryCycle?: string | null;
  paymentTerms?: string | null;
  moldPaymentTerms?: string | null;
  priceTier?: string | null;
  backgroundInfo?: string | null;
  evaluation?: string | null;
};

/** 將 products（Json 欄位）轉為 prisma 可接受的值：null → JsonNull，undefined → 不變更 */
const jsonOf = (
  v: QuoteProduct[] | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =>
  v === undefined ? undefined : v === null ? Prisma.JsonNull : (v as unknown as Prisma.InputJsonValue);

export const addQuote = async (eventId: number, data: QuoteInput) => {
  await getEvent(eventId);
  return prisma.sourcingQuote.create({
    data: { eventId, ...data, products: jsonOf(data.products) } as Prisma.SourcingQuoteUncheckedCreateInput,
  });
};

export const updateQuote = async (id: number, data: Partial<QuoteInput>) => {
  const q = await prisma.sourcingQuote.findUnique({ where: { id } });
  if (!q) throw notFound('找不到该报价');
  return prisma.sourcingQuote.update({
    where: { id },
    data: { ...data, products: jsonOf(data.products) } as Prisma.SourcingQuoteUncheckedUpdateInput,
  });
};

export const deleteQuote = async (id: number) => {
  const q = await prisma.sourcingQuote.findUnique({ where: { id } });
  if (!q) throw notFound('找不到该报价');
  await prisma.sourcingQuote.delete({ where: { id } });
  return { ok: true };
};

/** 標記某報價為「最優一家」（同案件其餘取消標記） */
export const markBest = async (quoteId: number) => {
  const q = await prisma.sourcingQuote.findUnique({ where: { id: quoteId } });
  if (!q) throw notFound('找不到该报价');
  await prisma.$transaction([
    prisma.sourcingQuote.updateMany({ where: { eventId: q.eventId }, data: { isBest: false } }),
    prisma.sourcingQuote.update({ where: { id: quoteId }, data: { isBest: true } }),
    prisma.sourcingEvent.update({ where: { id: q.eventId }, data: { status: 'decided' } }),
  ]);
  return { ok: true };
};
