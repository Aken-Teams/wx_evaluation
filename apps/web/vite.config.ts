import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // 统一从仓库根目录读取 .env（仅 VITE_ 前缀会进浏览器）
  envDir: fileURLToPath(new URL('../../', import.meta.url)),
  server: {
    // 開發（測試區）：npm run dev
    port: 12073,
    proxy: {
      '/api': {
        target: 'http://localhost:12074',
        changeOrigin: true,
      },
    },
  },
  preview: {
    // 正式區：build 後以 vite preview 提供靜態檔，/api 代理到後端 12074
    port: 12073,
    proxy: {
      '/api': {
        target: 'http://localhost:12074',
        changeOrigin: true,
      },
    },
  },
});
