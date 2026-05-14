/**
 * 应用错误类型定义
 *
 * 定义业务层使用的自定义错误类层次结构。Service 层通过抛出
 * 这些错误来表达业务异常，Runtime 层统一捕获并转换为标准的
 * ErrorResponse 格式返回给客户端。
 *
 * 错误分类：
 * - ValidationError (400): 请求数据验证失败，携带字段级错误详情
 * - AuthenticationError (401): 认证失败，统一错误信息不泄露具体原因
 * - NotFoundError (404): 资源不存在（权限不足也返回 404，不泄露存在性）
 * - ConflictError (409): 资源冲突（如邮箱已注册）
 */

import type { FieldError } from '../../../boundary/parse-request.js';

/**
 * 应用错误基类
 *
 * 所有业务异常的基类，携带机器可读的错误码、HTTP 状态码、
 * 人类可读的错误描述，以及可选的字段级错误详情。
 */
export class AppError extends Error {
  constructor(
    /** 机器可读的错误码，如 "VALIDATION_ERROR"、"TASK_NOT_FOUND" */
    public readonly code: string,
    /** 对应的 HTTP 状态码 */
    public readonly statusCode: number,
    /** 人类可读的错误描述 */
    message: string,
    /** 字段级错误详情（仅验证错误时存在） */
    public readonly details?: FieldError[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * 请求验证错误 (400)
 *
 * 当请求数据不符合 Zod schema 约束时抛出，
 * 携带具体的字段级错误信息供前端展示。
 */
export class ValidationError extends AppError {
  constructor(details: FieldError[]) {
    super('VALIDATION_ERROR', 400, '请求数据验证失败', details);
    this.name = 'ValidationError';
  }
}

/**
 * 认证失败错误 (401)
 *
 * 当用户凭证无效时抛出。无论是邮箱不存在还是密码错误，
 * 均返回相同的错误码和消息，防止信息泄露。
 */
export class AuthenticationError extends AppError {
  constructor() {
    super('INVALID_CREDENTIALS', 401, '认证失败');
    this.name = 'AuthenticationError';
  }
}

/**
 * 资源不存在错误 (404)
 *
 * 当请求的资源不存在时抛出。为防止信息泄露，
 * 当用户无权访问某资源时也应返回此错误（而非 403）。
 *
 * @param resource - 资源名称，如 "task"、"user"
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource.toUpperCase()}_NOT_FOUND`, 404, `${resource} 不存在`);
    this.name = 'NotFoundError';
  }
}

/**
 * 资源冲突错误 (409)
 *
 * 当操作与现有资源状态冲突时抛出，
 * 如注册时邮箱已被使用。
 *
 * @param code - 具体的冲突错误码，如 "EMAIL_ALREADY_REGISTERED"
 * @param message - 冲突原因描述
 */
export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(code, 409, message);
    this.name = 'ConflictError';
  }
}
