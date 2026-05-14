/**
 * 环境变量 Schema 定义与解析
 *
 * 使用 Zod 对 process.env 进行强类型解析，确保应用启动时
 * 所有必需的环境变量均已正确配置。解析失败时输出缺失字段
 * 并以 exit(1) 退出进程。
 *
 * 注意：业务代码禁止直接访问 process.env，必须通过本模块
 * 导出的 parseEnv() 获取类型安全的配置对象。
 */

import { z } from 'zod';

/**
 * 环境变量 Zod Schema
 *
 * 定义所有后端服务所需的环境变量及其类型约束：
 * - NODE_ENV: 运行环境（development/production/test）
 * - PORT: HTTP 监听端口
 * - DATABASE_URL: 数据库连接字符串
 * - JWT_SECRET: JWT 签名密钥（至少 32 字符）
 * - JWT_EXPIRES_IN: JWT 过期时间
 * - OTEL_EXPORTER_OTLP_ENDPOINT: OpenTelemetry 导出端点（可选）
 * - LOG_LEVEL: 日志级别
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

/** 环境变量类型（从 Schema 推导） */
export type Env = z.infer<typeof EnvSchema>;

/**
 * 解析环境变量
 *
 * 从 process.env 中解析并验证所有必需的环境变量。
 * 如果解析失败，将缺失或非法的字段信息输出到 stderr 并退出进程。
 *
 * @returns 类型安全的环境变量配置对象
 */
export function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`);
    process.stderr.write(`环境变量解析失败:\n${missing.join('\n')}\n`);
    process.exit(1);
  }
  return result.data;
}
