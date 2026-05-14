/**
 * LoginPage — 用户登录页面
 *
 * 提供邮箱 + 密码登录表单。
 * 登录成功后重定向到 /tasks，失败时显示错误信息。
 *
 * data-testid:
 * - page-login: 页面容器
 * - form-login: 登录表单
 * - input-email: 邮箱输入框
 * - input-password: 密码输入框
 * - btn-submit: 提交按钮
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

/**
 * 登录页面组件
 * 处理用户凭证输入与登录请求
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  /**
   * 处理表单提交
   * 调用登录接口，成功后跳转到任务列表页
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const success = await login({ email, password });
    if (success) {
      navigate('/tasks');
    }
    // 错误信息通过 error 状态在页面内展示
  };

  return (
    <div
      data-testid="page-login"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 32,
          backgroundColor: '#fff',
          borderRadius: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        }}
      >
        <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 700, textAlign: 'center' }}>
          登录
        </h1>

        <form data-testid="form-login" onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="login-email"
              style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}
            >
              邮箱
            </label>
            <input
              id="login-email"
              data-testid="input-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="请输入邮箱地址"
              required
              autoComplete="email"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              htmlFor="login-password"
              style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}
            >
              密码
            </label>
            <input
              id="login-password"
              data-testid="input-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div
              data-testid="login-error"
              role="alert"
              style={{
                marginBottom: 16,
                padding: '10px 12px',
                borderRadius: 6,
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                fontSize: 13,
              }}
            >
              {error.message || '登录失败，请检查邮箱和密码'}
            </div>
          )}

          <button
            data-testid="btn-submit"
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: loading ? '#9ca3af' : '#3b82f6',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 14, color: '#6b7280' }}>
          还没有账号？{' '}
          <Link to="/register" style={{ color: '#3b82f6', textDecoration: 'none' }}>
            立即注册
          </Link>
        </p>
      </div>
    </div>
  );
}
