/**
 * 任务卡片组件
 *
 * 职责：
 * - 在任务列表中展示单条任务的摘要信息
 * - 显示标题、状态徽章、优先级徽章、截止日期
 * - 提供编辑和删除操作按钮
 * - 通过 data-testid 支持端到端测试定位
 */
import React from 'react';
import type { Task } from '../types/index.js';

/** TaskCard 组件 Props */
export interface TaskCardProps {
  /** 任务实体数据 */
  task: Task;
  /** 点击编辑按钮的回调 */
  onEdit: (task: Task) => void;
  /** 点击删除按钮的回调 */
  onDelete: (task: Task) => void;
}

/** 状态显示文本映射 */
const STATUS_LABELS: Record<Task['status'], string> = {
  pending: '待处理',
  in_progress: '进行中',
  done: '已完成',
};

/** 优先级显示文本映射 */
const PRIORITY_LABELS: Record<Task['priority'], string> = {
  low: '低',
  normal: '普通',
  high: '高',
};

/**
 * 任务卡片组件
 * 展示单条任务的关键信息与操作入口
 */
export const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDelete }) => {
  return (
    <div
      data-testid={`item-tasks-${task.id}`}
      className="task-card"
      style={cardStyle}
    >
      <div className="task-card-header" style={headerStyle}>
        <h3 className="task-card-title" style={titleStyle}>
          {task.title}
        </h3>
        <div className="task-card-actions" style={actionsStyle}>
          <button
            data-testid="btn-edit-task"
            className="btn btn-edit"
            style={editBtnStyle}
            onClick={() => onEdit(task)}
            aria-label={`编辑任务: ${task.title}`}
          >
            编辑
          </button>
          <button
            data-testid="btn-delete-task"
            className="btn btn-delete"
            style={deleteBtnStyle}
            onClick={() => onDelete(task)}
            aria-label={`删除任务: ${task.title}`}
          >
            删除
          </button>
        </div>
      </div>

      <div className="task-card-meta" style={metaStyle}>
        <span
          className="badge badge-status"
          style={statusBadgeStyle(task.status)}
        >
          {STATUS_LABELS[task.status]}
        </span>
        <span
          className="badge badge-priority"
          style={priorityBadgeStyle(task.priority)}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>
        {task.due_date && (
          <span className="task-card-due-date" style={dueDateStyle}>
            截止: {formatDate(task.due_date)}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * 格式化 ISO 8601 日期为本地可读格式
 * @param isoDate - ISO 8601 日期字符串
 * @returns 格式化后的日期字符串（如 2024-01-15）
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/* ============================================================
 * 内联样式
 * ============================================================ */

const cardStyle: React.CSSProperties = {
  padding: '16px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  backgroundColor: '#ffffff',
  marginBottom: 8,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 12,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 500,
  color: '#1f2937',
  flex: 1,
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginLeft: 12,
};

const editBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  backgroundColor: '#ffffff',
  color: '#374151',
  cursor: 'pointer',
  fontSize: 13,
};

const deleteBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 4,
  border: '1px solid #fecaca',
  backgroundColor: '#fef2f2',
  color: '#dc2626',
  cursor: 'pointer',
  fontSize: 13,
};

const metaStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
};

const statusBadgeStyle = (status: Task['status']): React.CSSProperties => {
  const colors: Record<Task['status'], { bg: string; text: string }> = {
    pending: { bg: '#fef3c7', text: '#92400e' },
    in_progress: { bg: '#dbeafe', text: '#1e40af' },
    done: { bg: '#d1fae5', text: '#065f46' },
  };
  const { bg, text } = colors[status];
  return {
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
    backgroundColor: bg,
    color: text,
  };
};

const priorityBadgeStyle = (priority: Task['priority']): React.CSSProperties => {
  const colors: Record<Task['priority'], { bg: string; text: string }> = {
    low: { bg: '#f3f4f6', text: '#6b7280' },
    normal: { bg: '#ede9fe', text: '#5b21b6' },
    high: { bg: '#fee2e2', text: '#991b1b' },
  };
  const { bg, text } = colors[priority];
  return {
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
    backgroundColor: bg,
    color: text,
  };
};

const dueDateStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
};
