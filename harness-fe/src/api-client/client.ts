/**
 * API Client — 前端与后端通信的统一入口
 *
 * 职责：
 * - 所有响应经 Zod Schema 运行时校验，确保类型安全
 * - 自动从 localStorage 注入 JWT Token
 * - 401 响应时自动清除 Token 并重定向到登录页
 * - 统一错误处理，返回 ApiResponse<T> 包装类型
 */
import type {
  ApiResponse,
  AuthResponse,
  CreateTaskInput,
  LoginRequest,
  PaginatedTasks,
  RegisterRequest,
  Task,
  TaskQuery,
  UpdateTaskInput,
  User,
} from '../types/index.js';
import {
  AuthResponseSchema,
  ErrorSchema,
  PaginatedTasksSchema,
  TaskSchema,
  UserSchema,
} from './schemas.js';
import type { ZodSchema } from 'zod';
import { z } from 'zod';

/** localStorage 中存储 JWT Token 的键名 */
const TOKEN_KEY = 'harness-demo.token';

/** API 基础路径前缀 */
const BASE_URL = '/api/v1';

/**
 * API 客户端类
 * 封装所有与后端的 HTTP 通信逻辑
 */
class ApiClient {
  /**
   * 从 localStorage 获取当前 JWT Token
   * @returns Token 字符串，未登录时返回 null
   */
  private getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * 将 JWT Token 存储到 localStorage
   * @param token - 登录成功后获取的 JWT Token
   */
  private setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  /**
   * 清除 localStorage 中的 JWT Token
   */
  private clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  /**
   * 通用 HTTP 请求方法
   * 负责请求发送、Token 注入、响应解析、错误处理
   *
   * @param method - HTTP 方法
   * @param path - 请求路径（相对于 BASE_URL）
   * @param body - 请求体（可选）
   * @param schema - 用于校验成功响应的 Zod Schema（可选，void 响应时不传）
   * @returns 统一的 ApiResponse 包装
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    schema?: ZodSchema<T>,
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {};

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${BASE_URL}${path}`;
    const options: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      // 401 未授权：仅对非登录接口执行清除 Token 并重定向
      // 登录接口本身返回 401 表示凭证无效，应走正常错误解析流程
      if (response.status === 401 && path !== '/auth/login') {
        this.clearToken();
        window.location.href = '/login';
        return { error: { code: 'UNAUTHORIZED', message: '认证已过期，请重新登录', trace_id: '' } };
      }

      // 204 No Content：无响应体
      if (response.status === 204) {
        return { data: undefined as unknown as T };
      }

      const json = await response.json();

      // 非成功状态码：解析错误响应
      if (!response.ok) {
        const errorBody = json.error ?? json;
        const parsed = ErrorSchema.safeParse(errorBody);
        if (parsed.success) {
          return { error: parsed.data };
        }
        // 无法解析为标准错误格式时，构造兜底错误
        return {
          error: {
            code: 'UNKNOWN_ERROR',
            message: '未知错误',
            trace_id: '',
          },
        };
      }

      // 成功响应：使用 Zod Schema 校验数据
      if (schema) {
        const parsed = schema.parse(json);
        return { data: parsed };
      }

      return { data: json as T };
    } catch (err) {
      // 网络错误或其他未预期异常
      return {
        error: {
          code: 'NETWORK_ERROR',
          message: '网络连接失败，请重试',
          trace_id: '',
        },
      };
    }
  }

  /**
   * 用户注册
   * @param data - 注册请求参数（邮箱 + 密码）
   * @returns 注册成功后的用户基本信息
   */
  async register(data: RegisterRequest): Promise<ApiResponse<User>> {
    return this.request('POST', '/auth/register', data, UserSchema);
  }

  /**
   * 用户登录
   * 登录成功后自动将 Token 存储到 localStorage
   * @param data - 登录请求参数（邮箱 + 密码）
   * @returns 认证响应（Token + 用户信息）
   */
  async login(data: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    const result = await this.request<AuthResponse>('POST', '/auth/login', data, AuthResponseSchema);
    if (result.data?.token) {
      this.setToken(result.data.token);
    }
    return result;
  }

  /**
   * 获取任务列表（分页 + 过滤 + 搜索）
   * @param query - 查询参数（页码、每页条数、状态、优先级、搜索词）
   * @returns 分页任务列表
   */
  async getTasks(query?: TaskQuery): Promise<ApiResponse<PaginatedTasks>> {
    const params = new URLSearchParams();
    if (query?.page !== undefined) params.set('page', String(query.page));
    if (query?.page_size !== undefined) params.set('page_size', String(query.page_size));
    if (query?.status) params.set('status', query.status);
    if (query?.priority) params.set('priority', query.priority);
    if (query?.search) params.set('search', query.search);

    const queryString = params.toString();
    const path = `/tasks${queryString ? `?${queryString}` : ''}`;
    return this.request('GET', path, undefined, PaginatedTasksSchema);
  }

  /**
   * 创建新任务
   * @param data - 创建任务输入参数
   * @returns 创建成功后的完整任务实体
   */
  async createTask(data: CreateTaskInput): Promise<ApiResponse<Task>> {
    return this.request('POST', '/tasks', data, TaskSchema);
  }

  /**
   * 获取指定任务的子任务列表
   * @param taskId - 父任务 ID
   * @returns 子任务列表
   */
  async getSubtasks(taskId: string): Promise<ApiResponse<Task[]>> {
    return this.request('GET', `/tasks/${taskId}/subtasks`, undefined, z.array(TaskSchema));
  }

  /**
   * 更新指定任务
   * @param id - 任务 ID
   * @param data - 需要更新的字段
   * @returns 更新后的完整任务实体
   */
  async updateTask(id: string, data: UpdateTaskInput): Promise<ApiResponse<Task>> {
    return this.request('PATCH', `/tasks/${id}`, data, TaskSchema);
  }

  /**
   * 删除指定任务
   * @param id - 任务 ID
   * @returns 空响应（成功时 data 为 undefined）
   */
  async deleteTask(id: string): Promise<ApiResponse<void>> {
    return this.request('DELETE', `/tasks/${id}`);
  }
}

/** 全局单例 API 客户端实例 */
export const apiClient = new ApiClient();
