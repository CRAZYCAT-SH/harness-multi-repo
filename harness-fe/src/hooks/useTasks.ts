/**
 * useTasks Hook — 任务数据管理
 *
 * 提供任务 CRUD、分页、过滤、搜索功能。
 * 封装与后端 API 的交互逻辑，向 UI 层暴露简洁的操作接口。
 */
import { useState, useCallback } from 'react';
import { apiClient } from '../api-client/client.js';
import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskQuery,
  TaskStatus,
  TaskPriority,
  ApiError,
} from '../types/index.js';

/** useTasks Hook 返回值类型 */
export interface UseTasksReturn {
  /** 当前页的任务列表 */
  tasks: Task[];
  /** 符合条件的任务总数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 是否正在加载中 */
  loading: boolean;
  /** 错误信息 */
  error: ApiError | null;
  /** 当前状态过滤器 */
  statusFilter: TaskStatus | undefined;
  /** 当前优先级过滤器 */
  priorityFilter: TaskPriority | undefined;
  /** 当前搜索关键词 */
  searchKeyword: string;
  /** 获取任务列表 */
  fetchTasks: (query?: TaskQuery) => Promise<void>;
  /** 创建新任务 */
  createTask: (data: CreateTaskInput) => Promise<Task | null>;
  /** 更新任务 */
  updateTask: (id: string, data: UpdateTaskInput) => Promise<Task | null>;
  /** 删除任务 */
  deleteTask: (id: string) => Promise<boolean>;
  /** 设置状态过滤器 */
  setStatusFilter: (status: TaskStatus | undefined) => void;
  /** 设置优先级过滤器 */
  setPriorityFilter: (priority: TaskPriority | undefined) => void;
  /** 设置搜索关键词 */
  setSearchKeyword: (keyword: string) => void;
  /** 设置当前页码 */
  setPage: (page: number) => void;
  /** 清除错误状态 */
  clearError: () => void;
}

/**
 * 任务数据管理 Hook
 * @returns 任务相关状态与操作方法
 */
export function useTasks(): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>(undefined);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | undefined>(undefined);
  const [searchKeyword, setSearchKeyword] = useState('');

  /**
   * 获取任务列表
   * @param query - 可选的查询参数覆盖
   */
  const fetchTasks = useCallback(async (query?: TaskQuery) => {
    setLoading(true);
    setError(null);
    try {
      const params: TaskQuery = {
        page: query?.page ?? page,
        page_size: query?.page_size ?? pageSize,
        status: query?.status ?? statusFilter,
        priority: query?.priority ?? priorityFilter,
        search: query?.search ?? (searchKeyword || undefined),
      };
      const result = await apiClient.getTasks(params);
      if (result.data) {
        setTasks(result.data.items);
        setTotal(result.data.total);
      }
      if (result.error) {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, priorityFilter, searchKeyword]);

  /**
   * 创建新任务
   * @param data - 创建任务输入参数
   * @returns 创建成功的任务实体，失败时返回 null
   */
  const createTask = useCallback(async (data: CreateTaskInput): Promise<Task | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.createTask(data);
      if (result.data) {
        return result.data;
      }
      if (result.error) {
        setError(result.error);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 更新指定任务
   * @param id - 任务 ID
   * @param data - 需要更新的字段
   * @returns 更新后的任务实体，失败时返回 null
   */
  const updateTask = useCallback(async (id: string, data: UpdateTaskInput): Promise<Task | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.updateTask(id, data);
      if (result.data) {
        // 更新本地列表中的对应任务
        setTasks(prev => prev.map(t => t.id === id ? result.data! : t));
        return result.data;
      }
      if (result.error) {
        setError(result.error);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 删除指定任务
   * @param id - 任务 ID
   * @returns 删除是否成功
   */
  const deleteTask = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.deleteTask(id);
      if (!result.error) {
        // 从本地列表中移除已删除的任务
        setTasks(prev => prev.filter(t => t.id !== id));
        setTotal(prev => prev - 1);
        return true;
      }
      setError(result.error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /** 清除当前错误状态 */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    tasks,
    total,
    page,
    pageSize,
    loading,
    error,
    statusFilter,
    priorityFilter,
    searchKeyword,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    setStatusFilter,
    setPriorityFilter,
    setSearchKeyword,
    setPage,
    clearError,
  };
}
