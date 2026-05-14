/**
 * TaskDetailPage — 任务详情与编辑页面
 *
 * 展示单个任务的完整信息，并提供编辑表单。
 * 支持修改标题、描述、状态、优先级、截止日期。
 *
 * data-testid:
 * - page-task-detail: 页面容器
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api-client/client.js';
import { useToast } from '../components/Toast.js';
import type { Task, UpdateTaskInput, TaskStatus, TaskPriority } from '../types/index.js';

/**
 * 任务详情页面组件
 * 加载指定任务并提供编辑功能
 */
export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [parentTask, setParentTask] = useState<Task | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);

  /** 编辑表单状态 */
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [parentId, setParentId] = useState<string>('');

  /**
   * 加载任务详情
   * 通过任务列表接口获取（后端暂无单独的 GET /tasks/:id 端点，
   * 这里直接使用 updateTask 的前置数据加载方式）
   */
  useEffect(() => {
    if (!id) return;

    const loadTask = async () => {
      setLoading(true);
      try {
        // 通过列表接口获取任务（搜索精确 ID）
        const result = await apiClient.getTasks({ page: 1, page_size: 100 });
        if (result.data) {
          setAllTasks(result.data.items);
          const found = result.data.items.find(t => t.id === id);
          if (found) {
            setTask(found);
            setTitle(found.title);
            setDescription(found.description ?? '');
            setStatus(found.status);
            setPriority(found.priority);
            setParentId(found.parent_id ?? '');
            const rawDate = found.due_date ?? '';
            setDueDate(rawDate.includes('T') ? rawDate.slice(0, rawDate.indexOf('T')) : rawDate);

            // 加载子任务
            const subtasksResult = await apiClient.getSubtasks(id);
            if (subtasksResult.data) {
              setSubtasks(subtasksResult.data);
            }

            // 加载父任务信息
            if (found.parent_id) {
              const parentFound = result.data.items.find(t => t.id === found.parent_id);
              if (parentFound) {
                setParentTask(parentFound);
              }
            }
          } else {
            showToast({ type: 'error', message: '任务不存在' });
            navigate('/tasks');
          }
        }
        if (result.error) {
          showToast({
            type: 'error',
            message: result.error.message || '加载失败',
            code: result.error.code,
            traceId: result.error.trace_id,
          });
        }
      } finally {
        setLoading(false);
      }
    };

    loadTask();
  }, [id, navigate, showToast]);

  /**
   * 处理保存编辑
   */
  const handleSave = useCallback(async () => {
    if (!id || !task) return;
    setSaving(true);

    const updates: UpdateTaskInput = {};
    if (title !== task.title) updates.title = title;
    if (description !== (task.description ?? '')) updates.description = description;
    if (status !== task.status) updates.status = status;
    if (priority !== task.priority) updates.priority = priority;

    const newDueDate = dueDate ? new Date(dueDate).toISOString() : null;
    if (newDueDate !== task.due_date) updates.due_date = newDueDate;

    // 检测父任务变更
    const newParentId = parentId || null;
    if (newParentId !== (task.parent_id ?? null)) {
      updates.parent_id = newParentId;
    }

    // 如果没有变更，直接返回
    if (Object.keys(updates).length === 0) {
      showToast({ type: 'info', message: '没有需要保存的变更' });
      setSaving(false);
      return;
    }

    try {
      const result = await apiClient.updateTask(id, updates);
      if (result.data) {
        setTask(result.data);
        showToast({ type: 'success', message: '任务已更新' });
      }
      if (result.error) {
        showToast({
          type: 'error',
          message: result.error.message || '更新失败',
          code: result.error.code,
          traceId: result.error.trace_id,
        });
      }
    } finally {
      setSaving(false);
    }
  }, [id, task, title, description, status, priority, dueDate, showToast]);

  if (loading) {
    return (
      <div data-testid="page-task-detail" style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
        <p style={{ textAlign: 'center', color: '#9ca3af' }}>加载中...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div data-testid="page-task-detail" style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
        <p style={{ textAlign: 'center', color: '#9ca3af' }}>任务不存在</p>
      </div>
    );
  }

  return (
    <div data-testid="page-task-detail" style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      {/* 返回按钮 */}
      <button
        data-testid="btn-back"
        onClick={() => navigate('/tasks')}
        style={{
          marginBottom: 16,
          padding: '6px 12px',
          borderRadius: 6,
          border: '1px solid #d1d5db',
          backgroundColor: '#fff',
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        ← 返回列表
      </button>

      <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700 }}>编辑任务</h1>

      {/* 编辑表单 */}
      <form
        data-testid="form-task-edit"
        onSubmit={e => { e.preventDefault(); handleSave(); }}
      >
        {/* 标题 */}
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="task-title"
            style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}
          >
            标题
          </label>
          <input
            id="task-title"
            data-testid="input-title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            maxLength={200}
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

        {/* 描述 */}
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="task-description"
            style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}
          >
            描述
          </label>
          <textarea
            id="task-description"
            data-testid="input-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              fontSize: 14,
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        {/* 状态与优先级 */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label
              htmlFor="task-status"
              style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}
            >
              状态
            </label>
            <select
              id="task-status"
              data-testid="select-task-status"
              value={status}
              onChange={e => setStatus(e.target.value as TaskStatus)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                fontSize: 14,
              }}
            >
              <option value="pending">待处理</option>
              <option value="in_progress">进行中</option>
              <option value="done">已完成</option>
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label
              htmlFor="task-priority"
              style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}
            >
              优先级
            </label>
            <select
              id="task-priority"
              data-testid="select-task-priority"
              value={priority}
              onChange={e => setPriority(e.target.value as TaskPriority)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                fontSize: 14,
              }}
            >
              <option value="low">低</option>
              <option value="normal">普通</option>
              <option value="high">高</option>
            </select>
          </div>
        </div>

        {/* 截止日期 */}
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="task-due-date"
            style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}
          >
            截止日期
          </label>
          <input
            id="task-due-date"
            data-testid="input-due-date"
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
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

        {/* 父任务 */}
        <div style={{ marginBottom: 24 }}>
          <label
            htmlFor="task-parent"
            style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}
          >
            父任务
          </label>
          <select
            id="task-parent"
            data-testid="select-parent-task"
            value={parentId}
            onChange={e => setParentId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              fontSize: 14,
            }}
          >
            <option value="">无（顶级任务）</option>
            {allTasks
              .filter(t => t.id !== id && t.parent_id !== id)
              .map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))
            }
          </select>
        </div>

        {/* 元信息 */}
        <div style={{ marginBottom: 24, padding: 12, borderRadius: 6, backgroundColor: '#f9fafb', fontSize: 13, color: '#6b7280' }}>
          <p style={{ margin: '0 0 4px' }}>创建时间: {new Date(task.created_at).toLocaleString('zh-CN')}</p>
          <p style={{ margin: 0 }}>更新时间: {new Date(task.updated_at).toLocaleString('zh-CN')}</p>
        </div>

        {/* 父任务链接 */}
        {parentTask && (
          <div data-testid="parent-task-link" style={{ marginBottom: 16, padding: 12, borderRadius: 6, border: '1px solid #e0e7ff', backgroundColor: '#eef2ff' }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>父任务：</span>
            <Link
              to={`/tasks/${parentTask.id}`}
              style={{ fontSize: 14, color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}
            >
              {parentTask.title}
            </Link>
          </div>
        )}

        {/* 子任务列表 */}
        {subtasks.length > 0 && (
          <div data-testid="subtask-list" style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>子任务 ({subtasks.length})</h3>
            <div style={{ borderRadius: 6, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              {subtasks.map((sub, idx) => (
                <Link
                  key={sub.id}
                  to={`/tasks/${sub.id}`}
                  data-testid={`subtask-link-${sub.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderBottom: idx < subtasks.length - 1 ? '1px solid #f3f4f6' : 'none',
                    textDecoration: 'none',
                    color: 'inherit',
                    backgroundColor: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{sub.title}</span>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontSize: 11,
                      backgroundColor: sub.status === 'done' ? '#d1fae5' : sub.status === 'in_progress' ? '#dbeafe' : '#fef3c7',
                      color: sub.status === 'done' ? '#065f46' : sub.status === 'in_progress' ? '#1e40af' : '#92400e',
                    }}>
                      {sub.status === 'done' ? '已完成' : sub.status === 'in_progress' ? '进行中' : '待处理'}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>→</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            data-testid="btn-save"
            type="submit"
            disabled={saving}
            style={{
              padding: '10px 24px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: saving ? '#9ca3af' : '#3b82f6',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
          <button
            data-testid="btn-cancel-edit"
            type="button"
            onClick={() => navigate('/tasks')}
            style={{
              padding: '10px 24px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              backgroundColor: '#fff',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
