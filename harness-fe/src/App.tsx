/**
 * App — 应用根组件
 *
 * 职责：
 * - React Router 路由配置
 * - 受保护路由守卫（未认证时重定向到 /login）
 * - Toast Provider 全局消息提示
 *
 * 路由表：
 * - /login — 登录页
 * - /register — 注册页
 * - /tasks — 任务列表页（需认证）
 * - /tasks/:id — 任务详情页（需认证）
 * - / — 重定向到 /tasks
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { TaskListPage } from './pages/TaskListPage.js';
import { TaskDetailPage } from './pages/TaskDetailPage.js';

/** localStorage 中存储 JWT Token 的键名 */
const TOKEN_KEY = 'harness-demo.token';

/**
 * ProtectedRoute — 受保护路由包装组件
 *
 * 检查 localStorage 中是否存在有效 Token：
 * - 存在：渲染子组件
 * - 不存在：重定向到 /login
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

/**
 * 应用根组件
 * 配置路由与全局 Provider
 */
export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* 公开路由 */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* 受保护路由 */}
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <TaskListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/:id"
            element={
              <ProtectedRoute>
                <TaskDetailPage />
              </ProtectedRoute>
            }
          />

          {/* 默认重定向 */}
          <Route path="/" element={<Navigate to="/tasks" replace />} />
          <Route path="*" element={<Navigate to="/tasks" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
