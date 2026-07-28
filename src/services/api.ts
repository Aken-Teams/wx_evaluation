import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

api.interceptors.request.use((config) => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth.token') : null
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    
    // 如果是 401，清除本地 token 並通知 AuthContext 登出
    if (error.response?.status === 401) {
      console.log('🔄 認證失敗，清除本地 token');
      localStorage.removeItem('auth.token');
      localStorage.removeItem('auth.role');
      localStorage.removeItem('auth.username');
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    
    return Promise.reject(error);
  }
)

export default api

export const changePassword = (payload: { currentPassword: string; newPassword: string }) =>
  api.post('/auth/change-password', payload)

export const resetUserPassword = (userId: number) =>
  api.post(`/admin/users/${userId}/reset-password`)


