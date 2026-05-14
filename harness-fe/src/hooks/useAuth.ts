/**
 * useAuth Hook — 认证状态管理
 *
 * 提供登录、注册、登出功能及当前认证状态。
 * 通过 localStorage 持久化 Token，实现页面刷新后保持登录态。
 */
import { useState, useCallback } from 'react';
import { apiClient } from '../api-client/client.js';
import type { LoginRequest, RegisterRequest, User, ApiError } from '../types/index.js';

/** localStorage 中存储 JWT Token 的键名 */
const TOKEN_KEY = 'harness-demo.token';

/** useAuth Hook 返回值类型 */
export interface UseAuthReturn {
  /** 当前用户信息（未登录时为 null） */
  user: User | null;
  /** 是否正在加载中 */
  loading: boolean;
  /** 错误信息 */
  error: ApiError | null;
  /** 是否已认证 */
  isAuthenticated: boolean;
  /** 执行登录 */
  login: (data: LoginRequest) => Promise<boolean>;
  /** 执行注册 */
  register: (data: RegisterRequest) => Promise<boolean>;
  /** 执行登出 */
  logout: () => void;
  /** 清除错误状态 */
  clearError: () => void;
}

/**
 * 认证状态管理 Hook
 * @returns 认证相关状态与操作方法
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  /** 判断是否已认证（localStorage 中存在 Token） */
  const isAuthenticated = !!localStorage.getItem(TOKEN_KEY);

  /**
   * 用户登录
   * @param data - 登录凭证（邮箱 + 密码）
   * @returns 登录是否成功
   */
  const login = useCallback(async (data: LoginRequest): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.login(data);
      if (result.data) {
        setUser(result.data.user);
        return true;
      }
      if (result.error) {
        setError(result.error);
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 用户注册
   * @param data - 注册信息（邮箱 + 密码）
   * @returns 注册是否成功
   */
  const register = useCallback(async (data: RegisterRequest): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.register(data);
      if (result.data) {
        return true;
      }
      if (result.error) {
        setError(result.error);
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 用户登出 — 清除 Token 与用户状态
   */
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  /**
   * 清除当前错误状态
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    login,
    register,
    logout,
    clearError,
  };
}
