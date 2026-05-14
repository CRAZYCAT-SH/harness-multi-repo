/**
 * 任务表单组件
 *
 * 职责：
 * - 用于创建新任务或编辑已有任务
 * - 包含字段：标题（input）、描述（textarea）、优先级（select）、截止日期（date input）
 * - 根据是否传入 initialData 自动切换创建/编辑模式
 * - 提交时调用 onSubmit 回调，加载中禁用表单
 */
import React, { useState } from 'react';
import type { CreateTaskInput, Task, TaskPriority } from '../types/index.js';

/** TaskForm 组件 Props */
export interface TaskFormProps {
  /** 编辑模式下的初始数据（不传则为创建模式） */
  initialData?: Task;
  /** 表单提交回调 */
  onSubmit: (data: CreateTaskInput) => void;
  /** 是否正在提交中（禁用表单） */
  isLoading: boolean;
}

/**
 * 任务创建/编辑表单组件
 * 根据 initialData 是否存在自动切换 data-testid
 */
export const TaskForm: React.FC<TaskFormProps> = ({ initialData, onSubmit, isLoading }) => {
  const isEditMode = !!initialData;

  const [title, setTitle] = useState(initialData?.title ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(initialData?.priority ?? 'normal');
  const [dueDate, setDueDate] = useState(initialData?.due_date?.split('T')[0] ?? '');

  /**
   * 处理表单提交
   * 组装 CreateTaskInput 数据并调用 onSubmit
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: CreateTaskInput = {
      title: title.trim(),
    };

    if (description.trim()) {
      data.description = description.trim();
    }

    if (priority !== 'normal') {
      data.priority = priority;
    }

    if (dueDate) {
      data.due_date = new Date(dueDate).toISOString();
    }

    onSubmit(data);
  };

  return (
    <form
      data-testid={isEditMode ? 'form-edit-task' : 'form-create-task'}
      className="task-form"
      style={formStyle}
      onSubmit={handleSubmit}
    >
      {/* 标题字段 */}
      <div className="form-field" style={fieldStyle}>
        <label htmlFor="task-title" style={labelStyle}>
          标题
        </label>
        <input
          id="task-title"
          data-testid="input-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="请输入任务标题"
          required
          maxLength={200}
          disabled={isLoading}
          style={inputStyle}
        />
      </div>

      {/* 描述字段 */}
      <div className="form-field" style={fieldStyle}>
        <label htmlFor="task-description" style={labelStyle}>
          描述
        </label>
        <textarea
          id="task-description"
          data-testid="input-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="请输入任务描述（可选）"
          disabled={isLoading}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {/* 优先级字段 */}
      <div className="form-field" style={fieldStyle}>
        <label htmlFor="task-priority" style={labelStyle}>
          优先级
        </label>
        <select
          id="task-priority"
          data-testid="select-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          disabled={isLoading}
          style={inputStyle}
        >
          <option value="low">低</option>
          <option value="normal">普通</option>
          <option value="high">高</option>
        </select>
      </div>

      {/* 截止日期字段 */}
      <div className="form-field" style={fieldStyle}>
        <label htmlFor="task-due-date" style={labelStyle}>
          截止日期
        </label>
        <input
          id="task-due-date"
          data-testid="input-due-date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          disabled={isLoading}
          style={inputStyle}
        />
      </div>

      {/* 提交按钮 */}
      <button
        data-testid="btn-submit"
        type="submit"
        className="btn btn-submit"
        style={submitBtnStyle}
        disabled={isLoading || !title.trim()}
      >
        {isLoading ? '提交中...' : isEditMode ? '保存修改' : '创建任务'}
      </button>
    </form>
  );
};

/* ============================================================
 * 内联样式
 * ============================================================ */

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 480,
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: '#374151',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  fontSize: 14,
  color: '#1f2937',
  backgroundColor: '#ffffff',
  outline: 'none',
};

const submitBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 6,
  border: 'none',
  backgroundColor: '#3b82f6',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  alignSelf: 'flex-start',
};
