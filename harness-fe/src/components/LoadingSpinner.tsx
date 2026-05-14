/**
 * 加载指示器组件
 *
 * 职责：
 * - 在数据加载期间显示旋转动画
 * - 使用纯 CSS 实现动画，无需外部依赖
 * - 提供无障碍标注（aria-label）
 */
import React from 'react';

/**
 * 加载旋转指示器
 * 使用 CSS border 技巧实现旋转动画
 */
export const LoadingSpinner: React.FC = () => {
  return (
    <div
      data-testid="loading-spinner"
      className="loading-spinner"
      style={wrapperStyle}
      role="status"
      aria-label="加载中"
    >
      <div style={spinnerStyle} />
      <style>{keyframes}</style>
    </div>
  );
};

/* ============================================================
 * 内联样式与 CSS 动画
 * ============================================================ */

const wrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
};

const spinnerStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: '3px solid #e5e7eb',
  borderTopColor: '#3b82f6',
  borderRadius: '50%',
  animation: 'harness-spin 0.8s linear infinite',
};

/** CSS @keyframes 动画定义 */
const keyframes = `
@keyframes harness-spin {
  to { transform: rotate(360deg); }
}
`;
