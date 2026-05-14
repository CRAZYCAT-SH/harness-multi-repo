/**
 * 请求数据解析工具
 *
 * 提供基于 Zod 的请求体解析函数，将 ZodError 转换为
 * 统一的 FieldError 格式，供 Runtime 层返回结构化错误响应。
 *
 * 所有外部输入（req.body、req.query、req.params）必须通过
 * 本模块的解析函数进入系统，禁止直接使用原始请求数据。
 */

import { ZodError, type ZodSchema } from 'zod';

/**
 * 字段级错误信息
 *
 * 用于向客户端返回具体哪个字段出了什么问题，
 * 便于前端在对应表单字段旁展示错误提示。
 */
export interface FieldError {
  /** 字段路径，如 "body.title" 或 "query.page" */
  field: string;
  /** 该字段的具体错误描述 */
  message: string;
}

/**
 * 将 ZodError 转换为 FieldError 数组
 *
 * 提取 Zod 验证错误中的每个 issue，将其 path 拼接为
 * 点分隔的字段路径，配合对应的错误消息。
 *
 * @param zodError - Zod 解析产生的错误对象
 * @returns 字段级错误数组
 */
export function zodErrorToFieldErrors(zodError: ZodError): FieldError[] {
  return zodError.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * 解析请求数据（严格模式）
 *
 * 使用给定的 Zod schema 解析数据，解析失败时直接抛出 ZodError。
 * 适用于已确认数据来源可靠或由上层统一捕获异常的场景。
 *
 * @param schema - Zod 验证 schema
 * @param data - 待解析的原始数据
 * @returns 解析后的强类型数据
 * @throws ZodError 当数据不符合 schema 时
 */
export function parseBody<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * 安全解析请求数据
 *
 * 使用给定的 Zod schema 解析数据，不抛出异常。
 * 返回带有 success 标志的联合类型结果：
 * - 成功时返回 { success: true, data: T }
 * - 失败时返回 { success: false, errors: FieldError[] }
 *
 * 适用于需要在 Runtime 层直接构造 400 响应的场景。
 *
 * @param schema - Zod 验证 schema
 * @param data - 待解析的原始数据
 * @returns 解析结果（成功或失败）
 */
export function safeParseBody<T>(
  schema: ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: FieldError[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: zodErrorToFieldErrors(result.error) };
}
