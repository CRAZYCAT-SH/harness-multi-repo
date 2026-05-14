/**
 * Auth 域类型定义与 Zod Schema
 *
 * 本文件定义认证域的所有数据类型与边界解析 Schema。
 * 所有外部输入（HTTP 请求体、数据库返回值）均通过 Zod 解析为强类型对象，
 * 遵循 "Parse, don't validate" 原则。
 */

import { z } from 'zod';

// ============================================================
// 请求 Schema 定义
// ============================================================

/**
 * 注册请求 Schema
 *
 * 校验规则：
 * - email: 必须为合法邮箱格式
 * - password: 最少 8 个字符
 */
export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/**
 * 登录请求 Schema
 *
 * 校验规则：
 * - email: 必须为合法邮箱格式
 * - password: 最少 1 个字符（非空即可）
 */
export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** 注册请求类型（从 Schema 推导） */
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

/** 登录请求类型（从 Schema 推导） */
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// ============================================================
// 数据库实体类型
// ============================================================

/**
 * 用户实体（对应数据库 users 表行）
 */
export interface User {
  /** 用户唯一标识（UUID） */
  id: string;
  /** 用户邮箱（唯一） */
  email: string;
  /** bcrypt 哈希后的密码 */
  password_hash: string;
  /** 创建时间（ISO 8601 格式） */
  created_at: string;
}

/**
 * 数据库用户行 Zod 解析 Schema
 *
 * 用于在 Repo 层对数据库查询结果进行类型安全解析，
 * 确保数据库返回值符合预期结构。
 */
export const UserRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  password_hash: z.string(),
  created_at: z.string(),
});

// ============================================================
// Token 与认证响应类型
// ============================================================

/**
 * JWT Token 载荷
 *
 * 包含用户身份信息与过期时间，用于认证中间件校验。
 */
export interface TokenPayload {
  /** 用户唯一标识 */
  user_id: string;
  /** 用户邮箱 */
  email: string;
  /** 过期时间（Unix 时间戳，秒） */
  exp: number;
}

/**
 * 认证响应
 *
 * 登录成功后返回的数据结构，包含 JWT token 与用户基本信息。
 */
export interface AuthResponse {
  /** 签发的 JWT token */
  token: string;
  /** 用户基本信息（不含敏感字段） */
  user: { id: string; email: string };
}
