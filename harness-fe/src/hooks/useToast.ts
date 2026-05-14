/**
 * useToast — Toast 通知状态管理 Hook
 *
 * 职责：
 * - 管理 toast 通知列表的显示与消失
 * - 支持错误通知（含错误码和 trace_id）和成功通知
 * - 自动在 5 秒后消失
 */
import { useState, useCallback } from 'react';
import type { ApiError } from '../types/index.js';

/** Toast 通知类型 */
export type ToastType = 'error' | 'success';

/** 单条 Toast 通知 */
export interface Toast {
  /** 唯一标识 */
  id: string;
  /** 通知消息内容 */
  message: string;
  /** 错误码（仅错误通知） */
  code?: string;
  /** OpenTelemetry trace ID（仅错误通知） */
  traceId?: string;
  /** 通知类型 */
  type: ToastType;
}

/** 自动消失延迟时间（毫秒） */
const AUTO_DISMISS_MS = 5000;

/** useToast Hook 返回值类型 */
export interface UseToastReturn {
  /** 当前活跃的 toast 通知列表 */
  toasts: Toast[];
  /** 显示错误通知（从 ApiError 中提取 code 和 trace_id） */
  showError: (error: ApiError) => void;
  /** 显示成功通知 */
  showSuccess: (message: string) => void;
  /** 手动关闭指定通知 */
  dismiss: (id: string) => void;
}

/** 生成简单的唯一 ID */
let toastCounter = 0;
function generateId(): string {
  toastCounter += 1;
  return `toast-${Date.now()}-${toastCounter}`;
}

/**
 * Toast 通知状态管理 Hook
 *
 * @returns toast 相关状态与操作方法
 *
 * @example
 * ```tsx
 * const { toasts, showError, showSuccess, dismiss } = useToast();
 *
 * // API 调用失败时显示错误通知
 * if (result.error) {
 *   showError(result.error);
 * }
 * ```
 */
export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);

  /**
   * 手动关闭指定通知
   *
   * @param id - 要关闭的 toast ID
   */
  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /**
   * 添加一条 toast 通知，并在 5 秒后自动消失
   *
   * @param toast - 要添加的 toast 对象
   */
  const addToast = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast]);

    // 5 秒后自动消失
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, AUTO_DISMISS_MS);
  }, []);

  /**
   * 显示错误通知
   * 从 ApiError 中提取 code 和 trace_id 展示在通知中
   *
   * @param error - API 错误响应对象
   */
  const showError = useCallback((error: ApiError) => {
    const toast: Toast = {
      id: generateId(),
      message: error.message,
      code: error.code,
      traceId: error.trace_id,
      type: 'error',
    };
    addToast(toast);
  }, [addToast]);

  /**
   * 显示成功通知
   *
   * @param message - 成功消息内容
   */
  const showSuccess = useCallback((message: string) => {
    const toast: Toast = {
      id: generateId(),
      message,
      type: 'success',
    };
    addToast(toast);
  }, [addToast]);

  return {
    toasts,
    showError,
    showSuccess,
    dismiss,
  };
}
