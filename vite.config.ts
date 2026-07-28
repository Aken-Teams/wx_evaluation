﻿﻿﻿﻿﻿﻿﻿import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      port: parseInt(env.VITE_PORT) || 12009,
      host: '0.0.0.0',
      strictPort: false,
      open: true,
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        'evaluation_frontend.theaken.com',
        '.theaken.com'
      ],
      hmr: {
        clientPort: parseInt(env.VITE_PORT) || 12009,
        host: 'localhost'
      },
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:3006',
          changeOrigin: true,
          secure: false
        }
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      },
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      dedupe: ['react', 'react-dom']
    },
    optimizeDeps: {
      include: [
        '@mui/material',
        '@mui/system',
        'prop-types',
        'react-is',
        'recharts',
        'html2canvas'
      ],
      esbuildOptions: {
        mainFields: ['module', 'main']
      },
      force: false
    }
  }
})
