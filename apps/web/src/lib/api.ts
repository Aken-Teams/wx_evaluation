import axios from 'axios';

const TOKEN_KEY = 'wx.auth.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 20000,
});

// 注入 token
api.interceptors.request.use((config) => {
  const t = tokenStore.get();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// 401 → 清 token 並派發事件（由 AuthContext 監聽導回登入）
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  },
);

/** 從 axios 錯誤取出後端訊息 */
export const apiErrorMessage = (e: unknown, fallback = '操作失败'): string => {
  if (axios.isAxiosError(e)) return (e.response?.data as { error?: string })?.error || e.message || fallback;
  return fallback;
};
