/**
 * API 响应 Zod 校验 Schema
 * 用于在前端对后端返回的 JSON 数据进行运行时类型校验，
 * 确保数据结构符合预期，防止因后端变更导致的隐式错误。
 */
import { z } from 'zod';

/** 用户信息 Schema */
export const UserSchema = z.object({
  /** 用户唯一标识 */
  id: z.string(),
  /** 用户邮箱 */
  email: z.string(),
});

/** 认证响应 Schema（登录成功后返回） */
export const AuthResponseSchema = z.object({
  /** JWT 令牌 */
  token: z.string(),
  /** 当前用户信息 */
  user: UserSchema,
});

/** 任务实体 Schema */
export const TaskSchema = z.object({
  /** 任务唯一标识 */
  id: z.string(),
  /** 任务所有者 ID */
  owner_id: z.string(),
  /** 任务标题 */
  title: z.string(),
  /** 任务描述，可为空 */
  description: z.string().nullable(),
  /** 任务状态 */
  status: z.enum(['pending', 'in_progress', 'done']),
  /** 任务优先级 */
  priority: z.enum(['low', 'normal', 'high']),
  /** 截止日期（ISO 8601），可为空 */
  due_date: z.string().nullable(),
  /** 父任务 ID（null 表示顶级任务） */
  parent_id: z.string().nullable(),
  /** 创建时间（ISO 8601） */
  created_at: z.string(),
  /** 最后更新时间（ISO 8601） */
  updated_at: z.string(),
});

/** 分页任务列表响应 Schema */
export const PaginatedTasksSchema = z.object({
  /** 当前页的任务列表 */
  items: z.array(TaskSchema),
  /** 符合条件的任务总数 */
  total: z.number(),
  /** 当前页码 */
  page: z.number(),
  /** 每页条数 */
  page_size: z.number(),
});

/** 错误响应 Schema */
export const ErrorSchema = z.object({
  /** 机器可读的错误码 */
  code: z.string(),
  /** 人类可读的错误描述 */
  message: z.string(),
  /** 字段级错误详情（仅验证错误时存在） */
  details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  /** OpenTelemetry trace ID */
  trace_id: z.string(),
});
