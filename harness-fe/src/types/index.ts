/**
 * 前端共享类型定义
 * 与后端 Zod schema 保持对齐，确保前后端类型一致性
 */

// ============================================================
// 枚举类型
// ============================================================

/** 任务状态：待处理 | 进行中 | 已完成 */
export type TaskStatus = 'pending' | 'in_progress' | 'done';

/** 任务优先级：低 | 普通 | 高 */
export type TaskPriority = 'low' | 'normal' | 'high';

// ============================================================
// 实体类型
// ============================================================

/** 任务实体，对应后端 Task 表结构 */
export interface Task {
  /** 任务唯一标识 */
  id: string;
  /** 任务所有者 ID */
  owner_id: string;
  /** 任务标题（1-200 字符） */
  title: string;
  /** 任务描述，可为空 */
  description: string | null;
  /** 任务状态 */
  status: TaskStatus;
  /** 任务优先级 */
  priority: TaskPriority;
  /** 截止日期（ISO 8601 格式），可为空 */
  due_date: string | null;
  /** 父任务 ID（null 表示顶级任务） */
  parent_id: string | null;
  /** 创建时间（ISO 8601 格式） */
  created_at: string;
  /** 最后更新时间（ISO 8601 格式） */
  updated_at: string;
}

/** 用户实体（不含敏感信息） */
export interface User {
  /** 用户唯一标识 */
  id: string;
  /** 用户邮箱 */
  email: string;
}

// ============================================================
// 认证相关类型
// ============================================================

/** 认证响应：登录成功后返回的 token 与用户信息 */
export interface AuthResponse {
  /** JWT 令牌 */
  token: string;
  /** 当前用户信息 */
  user: User;
}

/** 注册请求参数 */
export interface RegisterRequest {
  /** 邮箱地址（需符合 email 格式） */
  email: string;
  /** 密码（长度 ≥ 8） */
  password: string;
}

/** 登录请求参数 */
export interface LoginRequest {
  /** 邮箱地址 */
  email: string;
  /** 密码 */
  password: string;
}

// ============================================================
// 任务操作类型
// ============================================================

/** 创建任务输入参数 */
export interface CreateTaskInput {
  /** 任务标题（必填，1-200 字符） */
  title: string;
  /** 任务描述（可选） */
  description?: string;
  /** 任务优先级（可选，默认 normal） */
  priority?: TaskPriority;
  /** 截止日期（可选，ISO 8601 格式） */
  due_date?: string;
  /** 父任务 ID（可选，指定后成为子任务） */
  parent_id?: string | null;
}

/** 更新任务输入参数（所有字段均为可选） */
export interface UpdateTaskInput {
  /** 任务标题 */
  title?: string;
  /** 任务描述 */
  description?: string;
  /** 任务状态 */
  status?: TaskStatus;
  /** 任务优先级 */
  priority?: TaskPriority;
  /** 截止日期，设为 null 可清除 */
  due_date?: string | null;
  /** 父任务 ID，设为 null 可移除父任务关系 */
  parent_id?: string | null;
}

/** 任务查询参数（用于列表接口的 query string） */
export interface TaskQuery {
  /** 页码（从 1 开始，默认 1） */
  page?: number;
  /** 每页条数（默认 20，上限 100） */
  page_size?: number;
  /** 按状态过滤 */
  status?: TaskStatus;
  /** 按优先级过滤 */
  priority?: TaskPriority;
  /** 搜索关键词（对 title 和 description 做大小写不敏感匹配） */
  search?: string;
}

// ============================================================
// 分页与响应类型
// ============================================================

/** 分页任务列表响应 */
export interface PaginatedTasks {
  /** 当前页的任务列表 */
  items: Task[];
  /** 符合条件的任务总数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  page_size: number;
}

/** API 错误响应结构 */
export interface ApiError {
  /** 机器可读的错误码（如 VALIDATION_ERROR、TASK_NOT_FOUND） */
  code: string;
  /** 人类可读的错误描述 */
  message: string;
  /** 字段级错误详情（仅验证错误时存在） */
  details?: Array<{ field: string; message: string }>;
  /** OpenTelemetry trace ID，用于问题追踪 */
  trace_id: string;
}

/** 统一 API 响应包装类型 */
export interface ApiResponse<T> {
  /** 成功时的数据载荷 */
  data?: T;
  /** 失败时的错误信息 */
  error?: ApiError;
}
