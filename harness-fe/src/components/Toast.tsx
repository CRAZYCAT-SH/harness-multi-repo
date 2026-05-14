/**
 * Toast 组件 — 全局消息提示
 *
 * 在页面顶部显示操作反馈信息（成功/错误/警告）。
 * 包含错误码与 trace_id 以便问题追踪。
 */
import React, { useEffect, useState, useCallback, createContext, useContext } from 'react';

/** Toast 消息类型 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/** Toast 消息数据结构 */
export interface ToastMessage {
  /** 唯一标识 */
  id: string;
  /** 消息类型 */
  type: ToastType;
  /** 显示内容 */
  message: string;
  /** 错误码（可选） */
  code?: string;
  /** Trace ID（可选，用于问题追踪） */
  traceId?: string;
  /** 自动关闭延时（毫秒），默认 5000 */
  duration?: number;
}

/** Toast 上下文类型 */
interface ToastContextType {
  /** 显示一条 Toast 消息 */
  showToast: (message: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

/**
 * 获取 Toast 上下文的 Hook
 * @returns Toast 操作方法
 */
export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast 必须在 ToastProvider 内部使用');
  }
  return context;
}

/**
 * Toast Provider — 提供全局 Toast 消息管理
 * 应包裹在应用根组件外层
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  /** 显示一条新的 Toast 消息 */
  const showToast = useCallback((message: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...message, id }]);
  }, []);

  /** 移除指定 Toast */
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        data-testid="toast-container"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * 单条 Toast 消息组件
 */
function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, toast.duration ?? 5000);
    return () => clearTimeout(timer);
  }, [toast.duration, onClose]);

  /** 根据类型确定背景色 */
  const bgColor = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  }[toast.type];

  return (
    <div
      data-testid="toast-item"
      role="alert"
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        backgroundColor: bgColor,
        color: '#fff',
        minWidth: 280,
        maxWidth: 400,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600 }}>{toast.message}</p>
          {toast.code && (
            <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.9 }}>
              错误码: {toast.code}
            </p>
          )}
          {toast.traceId && (
            <p style={{ margin: '2px 0 0', fontSize: 11, opacity: 0.8 }}>
              Trace: {toast.traceId}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="关闭提示"
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: '0 0 0 8px',
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
