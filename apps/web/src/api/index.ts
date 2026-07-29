import type { ScoringConfig } from '@wx/scoring';
import { api } from '../lib/api';
import type {
  AuthUser,
  EvaluationRow,
  Period,
  Quarter,
  Supplier,
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

// ── Users ──
export const usersApi = {
  list: () => api.get<UserRow[]>('/users').then((r) => r.data),
  create: (data: { username: string; password: string; role: string }) =>
    api.post<UserRow>('/users', data).then((r) => r.data),
  update: (id: number, data: { role?: string; enabled?: boolean }) =>
    api.put<UserRow>(`/users/${id}`, data).then((r) => r.data),
  resetPassword: (id: number) =>
    api.post<{ tempPassword: string }>(`/users/${id}/reset-password`).then((r) => r.data),
  changePassword: (oldPassword: string, newPassword: string) =>
    api.post('/users/change-password', { oldPassword, newPassword }).then((r) => r.data),
};

// ── Scoring config ──
export const scoringConfigApi = {
  get: () => api.get<{ config: ScoringConfig; defaults: ScoringConfig }>('/scoring-config').then((r) => r.data),
  save: (config: ScoringConfig) => api.put('/scoring-config', config).then((r) => r.data),
  reset: () => api.post<ScoringConfig>('/scoring-config/reset').then((r) => r.data),
};

// ── Analytics ──
export const analyticsApi = {
  periods: () => api.get<Period[]>('/analytics/periods').then((r) => r.data),
  summary: (year: number, quarter: Quarter) =>
    api.get<SummaryResponse>(`/analytics/summary/${year}/${quarter}`).then((r) => r.data),
  trend: (year: number) => api.get<TrendPoint[]>(`/analytics/trend/${year}`).then((r) => r.data),
};
