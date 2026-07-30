import type { ScoringConfig } from '@wx/scoring';
import { api } from '../lib/api';
import type {
  AnnualRow,
  AuthUser,
  BackgroundRow,
  EvaluationRow,
  OsatPeriod,
  OsatRow,
  Period,
  Quarter,
  SourcingEvent,
  SourcingEventDetail,
  SourcingQuote,
  SourcingRecommendation,
  Supplier,
  SupplierProfile,
  SummaryResponse,
  TrendPoint,
  UserRow,
} from '../types';

// ── Auth ──
export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; user: AuthUser }>('/auth/login', { username, password }).then((r) => r.data),
  me: () => api.get<{ user: AuthUser }>('/auth/me').then((r) => r.data.user),
};

// ── Suppliers ──
export interface SupplierInput {
  name: string;
  supplierCode?: string | null;
  materialCategory?: string | null;
  region?: string | null;
  isAU?: string | null;
  vendorType?: string;
}

export const suppliersApi = {
  list: () => api.get<Supplier[]>('/suppliers').then((r) => r.data),
  profile: (id: number) => api.get<SupplierProfile>(`/suppliers/${id}/profile`).then((r) => r.data),
  create: (data: SupplierInput) => api.post<Supplier>('/suppliers', data).then((r) => r.data),
  update: (id: number, data: SupplierInput) => api.put<Supplier>(`/suppliers/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/suppliers/${id}`).then((r) => r.data),
  batch: (items: SupplierInput[]) =>
    api.post<{ created: number; updated: number; total: number }>('/suppliers/batch', { items }).then((r) => r.data),
};

// ── Evaluations ──
export interface SaveEvaluationItem {
  vendorId: number;
  receivedQuantity?: string;
  returnedQuantity?: string;
  receivedBatches: number;
  returnedBatches: number;
  arr: number;
  lrr?: number;
  externalCAR: number;
  untimelyResponseCCR: number;
  others?: number;
  serviceQuality: number;
  lateDelivery?: number;
  deliveryRate: number | null;
  specialApproval: number;
  productionLineStop: number;
  excessFreight?: number;
  servicePurchase: number;
  remarks?: string | null;
}

export const evaluationsApi = {
  getQuarterly: (year: number, quarter: Quarter) =>
    api.get<EvaluationRow[]>(`/evaluations/quarterly/${year}/${quarter}`).then((r) => r.data),
  saveQuarterly: (year: number, quarter: Quarter, items: SaveEvaluationItem[]) =>
    api.put(`/evaluations/quarterly/${year}/${quarter}`, { items }).then((r) => r.data),
};

// ── Annual evaluation ──
export interface SaveAnnualItem {
  vendorId: number;
  VDA: number | null;
  QSA: number | null;
  QPA: number | null;
  HSF: number | null;
  CSR: number | null;
  others: number | null;
  nextYearAuditType?: string | null;
  remarks?: string | null;
}

export const annualApi = {
  get: (year: number) => api.get<AnnualRow[]>(`/evaluations/annual/${year}`).then((r) => r.data),
  save: (year: number, items: SaveAnnualItem[]) =>
    api.put(`/evaluations/annual/${year}`, { items }).then((r) => r.data),
};

// ── OSAT ──
export const osatApi = {
  periods: () => api.get<OsatPeriod[]>('/osat/periods').then((r) => r.data),
  getMonthly: (year: number, month: number) =>
    api.get<OsatRow[]>(`/osat/monthly/${year}/${month}`).then((r) => r.data),
};

// ── Background check ──
export interface SaveBackgroundItem {
  vendorId: number;
  latePaymentCount: number;
  customerComplaintCount: number;
  qualityAbnormal8D: number;
  cooperationScore: number | null;
  notes?: string | null;
}
export const backgroundApi = {
  get: (year: number) => api.get<BackgroundRow[]>(`/background/${year}`).then((r) => r.data),
  save: (year: number, items: SaveBackgroundItem[]) =>
    api.put(`/background/${year}`, { items }).then((r) => r.data),
};

// ── Sourcing (比价寻源) ──
export type QuoteInput = Partial<Omit<SourcingQuote, 'id' | 'eventId' | 'isBest'>> & { supplierName: string };
export const sourcingApi = {
  listEvents: () => api.get<SourcingEvent[]>('/sourcing/events').then((r) => r.data),
  createEvent: (data: { title: string; itemName?: string | null; description?: string | null }) =>
    api.post<SourcingEvent>('/sourcing/events', data).then((r) => r.data),
  getEvent: (id: number) => api.get<SourcingEventDetail>(`/sourcing/events/${id}`).then((r) => r.data),
  deleteEvent: (id: number) => api.delete(`/sourcing/events/${id}`).then((r) => r.data),
  addQuote: (eventId: number, data: QuoteInput) =>
    api.post<SourcingQuote>(`/sourcing/events/${eventId}/quotes`, data).then((r) => r.data),
  updateQuote: (id: number, data: Partial<QuoteInput>) =>
    api.put<SourcingQuote>(`/sourcing/quotes/${id}`, data).then((r) => r.data),
  deleteQuote: (id: number) => api.delete(`/sourcing/quotes/${id}`).then((r) => r.data),
  markBest: (id: number) => api.post(`/sourcing/quotes/${id}/best`).then((r) => r.data),
  recommend: (id: number) => api.post<SourcingRecommendation>(`/sourcing/events/${id}/recommend`).then((r) => r.data),
};

// ── Users ──
export const usersApi = {
  list: () => api.get<UserRow[]>('/users').then((r) => r.data),
  create: (data: { username: string; password: string; role: string }) =>
    api.post<UserRow>('/users', data).then((r) => r.data),
  update: (id: number, data: { role?: string; enabled?: boolean }) =>
    api.put<UserRow>(`/users/${id}`, data).then((r) => r.data),
  resetPassword: (id: number, password?: string) =>
    api.post<{ tempPassword: string | null }>(`/users/${id}/reset-password`, password ? { password } : {}).then((r) => r.data),
  changePassword: (oldPassword: string, newPassword: string) =>
    api.post('/users/change-password', { oldPassword, newPassword }).then((r) => r.data),
};

// ── Scoring config ──
export const scoringConfigApi = {
  get: () => api.get<{ config: ScoringConfig; defaults: ScoringConfig }>('/scoring-config').then((r) => r.data),
  save: (config: ScoringConfig) => api.put('/scoring-config', config).then((r) => r.data),
  reset: () => api.post<ScoringConfig>('/scoring-config/reset').then((r) => r.data),
};

// ── AI 问答 ──
export interface ChatMsg {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
export const aiApi = {
  status: () => api.get<{ configured: boolean }>('/ai/status').then((r) => r.data),
  chat: (messages: ChatMsg[]) =>
    api.post<{ configured: boolean; reply: string }>('/ai/chat', { messages }).then((r) => r.data),
};

// ── Analytics ──
export const analyticsApi = {
  periods: () => api.get<Period[]>('/analytics/periods').then((r) => r.data),
  summary: (year: number, quarter: Quarter) =>
    api.get<SummaryResponse>(`/analytics/summary/${year}/${quarter}`).then((r) => r.data),
  trend: (year: number) => api.get<TrendPoint[]>(`/analytics/trend/${year}`).then((r) => r.data),
};
