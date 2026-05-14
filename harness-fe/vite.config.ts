import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 后端端口：优先从环境变量读取（Worktree Launcher 动态分配），默认 3000
const backendPort = process.env.VITE_BACKEND_PORT || '3000';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 开发环境代理：将 /api 请求转发到后端服务（端口由 Worktree Launcher 分配）
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
