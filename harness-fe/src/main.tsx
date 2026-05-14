/**
 * 应用入口文件
 *
 * 挂载 React 应用到 DOM root 节点。
 * App 组件包含完整的路由配置与全局 Provider。
 * 在应用启动前初始化 OpenTelemetry 遥测。
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { initTelemetry } from './telemetry.js';

// 初始化前端遥测（追踪页面加载、路由切换、API 调用）
initTelemetry();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('未找到 root 元素，请检查 index.html');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
