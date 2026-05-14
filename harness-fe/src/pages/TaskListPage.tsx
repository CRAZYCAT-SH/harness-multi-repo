/**
 * TaskListPage — 任务列表页面
 *
 * 展示当前用户的任务列表，支持：
 * - 按状态过滤（select-status）
 * - 按优先级过滤（select-priority）
 * - 关键词搜索（input-search）
 * - 创建新任务（btn-create-task）
 * - 删除任务（含二次确认对话框）
 *
 * data-testid:
 * - page-tasks: 页面容器
 * - list-tasks: 任务列表容器
 * - btn-create-task: 创建任务按钮
 * - input-search: 搜索输入框
 * - select-status: 状态过滤下拉框
 * - select-priority: 优先级过滤下拉框
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../hooks/useTasks.js';
import { useToast } from '../components/Toast.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import type { Task, TaskStatus, TaskPriority, CreateTaskInput } from '../types/index.js';

/** 状态选项映射 */
const STATUS_OPTIONS: { value: TaskStatus | ''; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待处理' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
];

/** 优先级选项映射 */
const PRIORITY_OPTIONS: { value: TaskPriority | ''; label: string }[] = [
  { value: '', label: '全部优先级' },
  { value: 'low', label: '低' },
  { value: 'normal', label: '普通' },
  { value: 'high', label: '高' },
];

/**
 * 任务列表页面组件
 * 管理任务的展示、过滤、搜索、创建与删除
 */
export function TaskListPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    tasks,
    total,
    page,
    loading,
    error,
    statusFilter,
    priorityFilter,
    searchKeyword,
    fetchTasks,
    createTask,
    deleteTask,
    setStatusFilter,
    setPriorityFilter,
    setSearchKeyword,
    setPage,
  } = useTasks();

  /** 删除确认对话框状态 */
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  /** 创建任务表单是否显示 */
  const [showCreateForm, setShowCreateForm] = useState(false);
  /** 新任务标题 */
  const [newTaskTitle, setNewTaskTitle] = useState('');
  /** 新任务的父任务 ID */
  const [newTaskParentId, setNewTaskParentId] = useState('');
  /** 展开的父任务 ID 集合 */
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  /**
   * 将任务列表按父子关系分组
   * 顶级任务：parent_id 为 null
   * 子任务：按 parent_id 分组挂在父任务下
   */
  const { topLevelTasks, childrenMap } = useMemo(() => {
    const childrenMap = new Map<string, Task[]>();
    const topLevelTasks: Task[] = [];

    for (const task of tasks) {
      if (task.parent_id) {
        const children = childrenMap.get(task.parent_id) || [];
        children.push(task);
        childrenMap.set(task.parent_id, children);
      } else {
        topLevelTasks.push(task);
      }
    }

    return { topLevelTasks, childrenMap };
  }, [tasks]);

  /** 切换父任务的展开/折叠状态 */
  const toggleExpand = useCallback((taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  /** 过滤条件或页码变更时重新获取任务列表 */
  useEffect(() => {
    fetchTasks({
      page,
      status: statusFilter,
      priority: priorityFilter,
      search: searchKeyword || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, priorityFilter, searchKeyword]);

  /** 错误时显示 Toast */
  useEffect(() => {
    if (error) {
      showToast({
        type: 'error',
        message: error.message || '操作失败',
        code: error.code,
        traceId: error.trace_id,
      });
    }
  }, [error, showToast]);

  /**
   * 处理状态过滤变更
   */
  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as TaskStatus | '';
    setStatusFilter(value || undefined);
    setPage(1);
  }, [setStatusFilter, setPage]);

  /**
   * 处理优先级过滤变更
   */
  const handlePriorityChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as TaskPriority | '';
    setPriorityFilter(value || undefined);
    setPage(1);
  }, [setPriorityFilter, setPage]);

  /**
   * 处理搜索关键词变更
   */
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchKeyword(e.target.value);
    setPage(1);
  }, [setSearchKeyword, setPage]);

  /**
   * 处理创建任务
   */
  const handleCreateTask = useCallback(async () => {
    if (!newTaskTitle.trim()) return;
    const input: CreateTaskInput = {
      title: newTaskTitle.trim(),
      ...(newTaskParentId ? { parent_id: newTaskParentId } : {}),
    };
    const task = await createTask(input);
    if (task) {
      setNewTaskTitle('');
      setNewTaskParentId('');
      setShowCreateForm(false);
      showToast({ type: 'success', message: '任务创建成功' });
      fetchTasks();
    }
  }, [newTaskTitle, newTaskParentId, createTask, showToast, fetchTasks]);

  /**
   * 处理删除确认
   */
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const success = await deleteTask(deleteTarget.id);
    if (success) {
      showToast({ type: 'success', message: '任务已删除' });
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteTask, showToast]);

  /**
   * 获取状态标签样式
   */
  const getStatusBadge = (status: TaskStatus) => {
    const styles: Record<TaskStatus, { bg: string; color: string; label: string }> = {
      pending: { bg: '#fef3c7', color: '#92400e', label: '待处理' },
      in_progress: { bg: '#dbeafe', color: '#1e40af', label: '进行中' },
      done: { bg: '#d1fae5', color: '#065f46', label: '已完成' },
    };
    const s = styles[status];
    return (
      <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: s.bg, color: s.color, fontSize: 12 }}>
        {s.label}
      </span>
    );
  };

  /**
   * 获取优先级标签样式
   */
  const getPriorityBadge = (priority: TaskPriority) => {
    const styles: Record<TaskPriority, { bg: string; color: string; label: string }> = {
      low: { bg: '#f3f4f6', color: '#6b7280', label: '低' },
      normal: { bg: '#e0e7ff', color: '#3730a3', label: '普通' },
      high: { bg: '#fee2e2', color: '#991b1b', label: '高' },
    };
    const s = styles[priority];
    return (
      <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: s.bg, color: s.color, fontSize: 12 }}>
        {s.label}
      </span>
    );
  };

  return (
    <div data-testid="page-tasks" style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      {/* 页面标题与创建按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>我的任务</h1>
        <button
          data-testid="btn-create-task"
          onClick={() => setShowCreateForm(true)}
          style={{
            padding: '10px 20px',
            borderRadius: 6,
            border: 'none',
            backgroundColor: '#3b82f6',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + 新建任务
        </button>
      </div>

      {/* 创建任务表单（内联） */}
      {showCreateForm && (
        <div
          data-testid="create-task-form"
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              data-testid="input-new-task-title"
              type="text"
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              placeholder="输入任务标题..."
              onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                fontSize: 14,
              }}
            />
            <button
              onClick={handleCreateTask}
              disabled={!newTaskTitle.trim()}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: '#10b981',
                color: '#fff',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              创建
            </button>
            <button
              onClick={() => { setShowCreateForm(false); setNewTaskTitle(''); setNewTaskParentId(''); }}
              style={{
                padding: '8px 16px',
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
          {/* 父任务选择 */}
          {tasks.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <select
                data-testid="select-new-task-parent"
                value={newTaskParentId}
                onChange={e => setNewTaskParentId(e.target.value)}
                aria-label="选择父任务"
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  fontSize: 13,
                  color: newTaskParentId ? '#111827' : '#9ca3af',
                }}
              >
                <option value="">无父任务（顶级任务）</option>
                {tasks.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* 过滤与搜索栏 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          data-testid="select-status"
          value={statusFilter ?? ''}
          onChange={handleStatusChange}
          aria-label="按状态过滤"
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            fontSize: 14,
          }}
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          data-testid="select-priority"
          value={priorityFilter ?? ''}
          onChange={handlePriorityChange}
          aria-label="按优先级过滤"
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            fontSize: 14,
          }}
        >
          {PRIORITY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <input
          data-testid="input-search"
          type="text"
          value={searchKeyword}
          onChange={handleSearchChange}
          placeholder="搜索任务..."
          aria-label="搜索任务"
          style={{
            flex: 1,
            minWidth: 200,
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            fontSize: 14,
          }}
        />
      </div>

      {/* 任务列表 */}
      <div data-testid="list-tasks">
        {loading && tasks.length === 0 && (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>加载中...</p>
        )}

        {!loading && tasks.length === 0 && (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>
            暂无任务，点击"新建任务"开始吧
          </p>
        )}

        {topLevelTasks.map(task => {
          const children = childrenMap.get(task.id) || [];
          const hasChildren = children.length > 0;
          const isExpanded = expandedIds.has(task.id);

          return (
            <div key={task.id}>
              {/* 父任务行 */}
              <div
                data-testid={`task-item-${task.id}`}
                style={{
                  padding: 16,
                  marginBottom: hasChildren && isExpanded ? 0 : 8,
                  borderRadius: hasChildren && isExpanded ? '8px 8px 0 0' : 8,
                  border: '1px solid #e5e7eb',
                  borderBottom: hasChildren && isExpanded ? '1px dashed #e5e7eb' : '1px solid #e5e7eb',
                  backgroundColor: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/tasks/${task.id}`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  {/* 展开/折叠按钮 */}
                  {hasChildren && (
                    <button
                      data-testid={`btn-toggle-${task.id}`}
                      onClick={(e) => toggleExpand(task.id, e)}
                      aria-label={isExpanded ? '折叠子任务' : '展开子任务'}
                      style={{
                        marginRight: 8,
                        padding: '2px 6px',
                        borderRadius: 4,
                        border: '1px solid #d1d5db',
                        backgroundColor: '#f9fafb',
                        fontSize: 12,
                        cursor: 'pointer',
                        lineHeight: 1,
                      }}
                    >
                      {isExpanded ? '▼' : '▶'} {children.length}
                    </button>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500, fontSize: 15 }}>{task.title}</span>
                      {getStatusBadge(task.status)}
                      {getPriorityBadge(task.priority)}
                    </div>
                    {task.description && (
                      <p style={{ margin: 0, fontSize: 13, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>
                        {task.description}
                      </p>
                    )}
                    {task.due_date && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
                        截止: {new Date(task.due_date).toLocaleDateString('zh-CN')}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  data-testid={`btn-delete-${task.id}`}
                  onClick={e => { e.stopPropagation(); setDeleteTarget(task); }}
                  aria-label={`删除任务: ${task.title}`}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid #fecaca',
                    backgroundColor: '#fff',
                    color: '#dc2626',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  删除
                </button>
              </div>

              {/* 子任务列表（折叠区域） */}
              {hasChildren && isExpanded && (
                <div
                  data-testid={`subtasks-${task.id}`}
                  style={{
                    marginBottom: 8,
                    borderRadius: '0 0 8px 8px',
                    border: '1px solid #e5e7eb',
                    borderTop: 'none',
                    backgroundColor: '#f9fafb',
                    paddingLeft: 24,
                  }}
                >
                  {children.map(child => (
                    <div
                      key={child.id}
                      data-testid={`task-item-${child.id}`}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                      onClick={() => navigate(`/tasks/${child.id}`)}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, color: '#6b7280' }}>└</span>
                          <span style={{ fontWeight: 400, fontSize: 14 }}>{child.title}</span>
                          {getStatusBadge(child.status)}
                          {getPriorityBadge(child.priority)}
                        </div>
                      </div>
                      <button
                        data-testid={`btn-delete-${child.id}`}
                        onClick={e => { e.stopPropagation(); setDeleteTarget(child); }}
                        aria-label={`删除任务: ${child.title}`}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid #fecaca',
                          backgroundColor: '#fff',
                          color: '#dc2626',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 分页信息 */}
      {total > 0 && (
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
          共 {total} 条任务，当前第 {page} 页
        </div>
      )}

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除"
        description={`确定要删除任务「${deleteTarget?.title ?? ''}」吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
