/**
 * RegisterPage — 用户注册页面
 *
 * 提供邮箱 + 密码注册表单。
 * 注册成功后重定向到 /login，失败时显示错误信息。
 * 包含跳转到登录页的链接。
 *
 * data-testid:
 * - page-register: 页面容器
 * - form-register: 注册表单
 * - input-email: 邮箱输入框
 * - input-password: 密码输入框
 * - btn-submit: 提交按钮
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../components/Toast.js';

/**
 * 注册页面组件
 * 处理用户注册信息输入与注册请求
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const { register, loading, error, clearError } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  /**
   * 处理表单提交
   * 调用注册接口，成功后跳转到登录页
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const success = await register({ email, password });
    if (success) {
      showToast({
        type: 'success',
        message: '注册成功，请登录',
      });
      navigate('/login');
    }
    // 错误信息通过 error 状态在页面内展示
  };

  return (
    <div
      data-testid="page-register"
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
          注册
        </h1>

        <form data-testid="form-register" onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="register-email"
              style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}
            >
              邮箱
            </label>
            <input
              id="register-email"
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
              htmlFor="register-password"
              style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}
            >
              密码
            </label>
            <input
              id="register-password"
              data-testid="input-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码（至少 8 位）"
              required
              minLength={8}
              autoComplete="new-password"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
              密码长度至少 8 个字符
            </p>
          </div>

          {error && (
            <div
              data-testid="register-error"
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
              {error.message || '注册失败，请重试'}
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
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 14, color: '#6b7280' }}>
          已有账号？{' '}
          <Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none' }}>
            立即登录
          </Link>
        </p>
      </div>
    </div>
  );
}
