/**
 * ConfirmDialog 组件 — 二次确认对话框
 *
 * 用于删除等不可逆操作前的用户确认。
 * 支持自定义标题、描述、确认/取消按钮文案。
 */
import 'react';

/** ConfirmDialog 组件属性 */
export interface ConfirmDialogProps {
  /** 是否显示对话框 */
  open: boolean;
  /** 对话框标题 */
  title: string;
  /** 对话框描述内容 */
  description: string;
  /** 确认按钮文案，默认"确认" */
  confirmText?: string;
  /** 取消按钮文案，默认"取消" */
  cancelText?: string;
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
}

/**
 * 二次确认对话框组件
 * 在执行危险操作（如删除）前要求用户明确确认
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      data-testid="confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      {/* 遮罩层 */}
      <div
        data-testid="confirm-dialog-overlay"
        onClick={onCancel}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}
      />
      {/* 对话框内容 */}
      <div
        style={{
          position: 'relative',
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: 24,
          minWidth: 320,
          maxWidth: 440,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <h2
          id="confirm-dialog-title"
          style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}
        >
          {title}
        </h2>
        <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: 14 }}>
          {description}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            data-testid="btn-cancel"
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              backgroundColor: '#fff',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {cancelText}
          </button>
          <button
            data-testid="btn-confirm"
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: '#ef4444',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
