/**
 * Task 域类型定义与 Zod Schema
 *
 * 定义任务管理域的所有数据类型、请求验证 Schema 和数据库行解析 Schema。
 * 遵循 "Parse, don't validate" 原则，所有外部边界数据经 Zod 解析为强类型。
 */

import { z } from 'zod';

// ============================================================
// 枚举定义
// ============================================================

/** 任务状态枚举：pending（待处理）、in_progress（进行中）、done（已完成） */
export const TaskStatusEnum = z.enum(['pending', 'in_progress', 'done']);

/** 任务优先级枚举：low（低）、normal（普通）、high（高） */
export const TaskPriorityEnum = z.enum(['low', 'normal', 'high']);

// ============================================================
// 请求验证 Schema
// ============================================================

/**
 * 创建任务请求 Schema
 *
 * 用于 POST /api/v1/tasks 端点的请求体验证。
 * - title: 必填，1-200 字符
 * - description: 可选，任务描述
 * - priority: 可选，默认 'normal'
 * - due_date: 可选，ISO 8601 日期时间格式
 */
export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: TaskPriorityEnum.optional().default('normal'),
  due_date: z.string().datetime().optional(),
  parent_id: z.string().nullable().optional(),
});

/**
 * 更新任务请求 Schema
 *
 * 用于 PATCH /api/v1/tasks/:id 端点的请求体验证。
 * 所有字段均为可选，仅更新提供的字段。
 * - due_date 支持 nullable，允许清除截止日期
 */
export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: TaskStatusEnum.optional(),
  priority: TaskPriorityEnum.optional(),
  due_date: z.string().datetime().nullable().optional(),
  parent_id: z.string().nullable().optional(),
});

/**
 * 任务列表查询 Schema
 *
 * 用于 GET /api/v1/tasks 端点的 query 参数验证。
 * - page: 页码，默认 1，正整数
 * - page_size: 每页条数，默认 20，上限 100
 * - status: 按状态过滤
 * - priority: 按优先级过滤
 * - search: 关键词搜索（对 title 和 description 大小写不敏感匹配）
 */
export const TaskQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(20),
  status: TaskStatusEnum.optional(),
  priority: TaskPriorityEnum.optional(),
  search: z.string().optional(),
});

// ============================================================
// 推导类型
// ============================================================

/** 创建任务的输入类型（从 CreateTaskSchema 推导） */
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

/** 更新任务的输入类型（从 UpdateTaskSchema 推导） */
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

/** 任务列表查询参数类型（从 TaskQuerySchema 推导） */
export type TaskQuery = z.infer<typeof TaskQuerySchema>;

// ============================================================
// 实体接口
// ============================================================

/**
 * 任务实体接口
 *
 * 表示数据库中一条完整的任务记录。
 */
export interface Task {
  /** 任务唯一标识（UUID） */
  id: string;
  /** 任务所有者用户 ID */
  owner_id: string;
  /** 任务标题 */
  title: string;
  /** 任务描述（可为空） */
  description: string | null;
  /** 任务状态 */
  status: 'pending' | 'in_progress' | 'done';
  /** 任务优先级 */
  priority: 'low' | 'normal' | 'high';
  /** 截止日期（ISO 8601 格式，可为空） */
  due_date: string | null;
  /** 父任务 ID（null 表示顶级任务） */
  parent_id: string | null;
  /** 创建时间（ISO 8601 格式） */
  created_at: string;
  /** 最后更新时间（ISO 8601 格式） */
  updated_at: string;
}

// ============================================================
// 数据库行解析 Schema
// ============================================================

/**
 * 数据库返回值 Zod 解析 Schema
 *
 * 用于 Repo 层对数据库查询结果进行类型安全解析，
 * 确保数据库返回的数据符合预期结构。
 */
export const TaskRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: TaskStatusEnum,
  priority: TaskPriorityEnum,
  due_date: z.string().nullable(),
  parent_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// ============================================================
// 分页响应接口
// ============================================================

/**
 * 分页任务列表响应接口
 *
 * 用于 GET /api/v1/tasks 端点的响应结构。
 */
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
