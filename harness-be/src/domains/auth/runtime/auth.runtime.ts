/**
 * Auth 域 Runtime 层（路由注册）
 *
 * 以 Fastify 插件模式注册认证相关的 HTTP 路由：
 * - POST /api/v1/auth/register — 用户注册
 * - POST /api/v1/auth/login — 用户登录
 *
 * 所有请求体通过 safeParseBody 进行边界解析，
 * 业务异常由 Service 层抛出并在此统一转换为标准 ErrorResponse。
 *
 * 依赖方向：types → config → repo → service → runtime（本层）
 *
 * @module auth.runtime
 */

import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { AuthService } from '../service/auth.service.js';
import { RegisterRequestSchema, LoginRequestSchema } from '../types/index.js';
import { safeParseBody } from '../../../boundary/parse-request.js';
import { AppError } from '../../shared/types/errors.js';

/**
 * Auth 路由插件工厂
 *
 * 接收 AuthService 实例，返回 Fastify 插件函数。
 * 插件内注册 register 和 login 两个公开端点（无需认证）。
 *
 * @param authService - Auth 域 Service 层实例
 * @returns Fastify 插件回调函数
 */
export function createAuthRoutes(authService: AuthService): FastifyPluginCallback {
  /**
   * Fastify 插件：注册 Auth 域路由
   */
  const authRoutes: FastifyPluginCallback = (fastify: FastifyInstance, _opts, done) => {
    /**
     * POST /api/v1/auth/register
     *
     * 用户注册端点。
     * - 使用 RegisterRequestSchema 解析请求体
     * - 调用 authService.register 创建用户
     * - 成功返回 201 { id, email }
     * - 邮箱冲突返回 409
     * - 请求体校验失败返回 400
     */
    fastify.post('/api/v1/auth/register', async (request, reply) => {
      // 边界解析请求体
      const parseResult = safeParseBody(RegisterRequestSchema, request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求数据验证失败',
            details: parseResult.errors,
            trace_id: request.id,
          },
        });
      }

      try {
        // 调用 Service 层执行注册逻辑
        const result = await authService.register(parseResult.data);
        return reply.status(201).send(result);
      } catch (err) {
        // 处理业务异常
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send({
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
              trace_id: request.id,
            },
          });
        }
        // 未预期异常向上抛出，由全局错误处理器处理
        throw err;
      }
    });

    /**
     * POST /api/v1/auth/login
     *
     * 用户登录端点。
     * - 使用 LoginRequestSchema 解析请求体
     * - 调用 authService.login 验证凭证并签发 Token
     * - 成功返回 200 { token, user: { id, email } }
     * - 凭证无效返回 401
     * - 请求体校验失败返回 400
     */
    fastify.post('/api/v1/auth/login', async (request, reply) => {
      // 边界解析请求体
      const parseResult = safeParseBody(LoginRequestSchema, request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求数据验证失败',
            details: parseResult.errors,
            trace_id: request.id,
          },
        });
      }

      try {
        // 调用 Service 层执行登录逻辑
        const result = await authService.login(parseResult.data);
        return reply.status(200).send(result);
      } catch (err) {
        // 处理业务异常
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send({
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
              trace_id: request.id,
            },
          });
        }
        // 未预期异常向上抛出
        throw err;
      }
    });

    done();
  };

  return authRoutes;
}
