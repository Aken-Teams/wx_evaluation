import { api } from '../lib/api';
import type {
  AuthUser,
  EvaluationRow,
  Period,
  Quarter,
  Supplier,
  SummaryResponse,
  TrendPoint,
} from '../types';

// ── Auth ──
export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; user: AuthUser }>('/auth/login', { username, password }).then((r) => r.data),
  me: () => api.get<{ user: AuthUser }>('/auth/me').then((r) => r.data.user),
};

// ── Suppliers ──
export const suppliersApi = {
  list: () => api.get<Supplier[]>('/suppliers').then((r) => r.data),
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

// ── Analytics ──
export const analyticsApi = {
  periods: () => api.get<Period[]>('/analytics/periods').then((r) => r.data),
  summary: (year: number, quarter: Quarter) =>
    api.get<SummaryResponse>(`/analytics/summary/${year}/${quarter}`).then((r) => r.data),
  trend: (year: number) => api.get<TrendPoint[]>(`/analytics/trend/${year}`).then((r) => r.data),
};
