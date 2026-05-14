/**
 * Auth 认证中间件
 *
 * 实现 Bearer Token 认证逻辑，用于保护需要登录才能访问的路由。
 *
 * 工作流程：
 * 1. 从请求头 Authorization 中提取 Bearer token
 * 2. 调用 AuthService.validateToken 验证 token 签名与有效期
 * 3. 验证通过：将解码后的用户信息附加到 request.user
 * 4. 验证失败：返回 401 错误响应
 *
 * 使用方式：
 * 在需要认证的路由插件中通过 fastify.addHook('onRequest', authMiddleware) 注册。
 *
 * @module auth.middleware
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthService } from '../service/auth.service.js';
import type { TokenPayload } from '../types/index.js';

/**
 * 扩展 Fastify Request 类型，附加认证用户信息
 *
 * 认证中间件验证通过后，会将 TokenPayload 挂载到 request.user 上，
 * 下游路由处理器可直接访问当前用户身份。
 */
declare module 'fastify' {
  interface FastifyRequest {
    /** 当前认证用户的 Token 载荷（仅在通过认证中间件后可用） */
    user?: TokenPayload;
  }
}

/**
 * 创建认证中间件
 *
 * 工厂函数，接收 AuthService 实例，返回 Fastify onRequest 钩子函数。
 * 该中间件会拦截所有请求，校验 Authorization 头中的 Bearer token。
 *
 * @param authService - Auth 域 Service 层实例，提供 validateToken 方法
 * @returns Fastify onRequest 钩子函数
 *
 * @example
 * ```typescript
 * const middleware = createAuthMiddleware(authService);
 * fastify.addHook('onRequest', middleware);
 * ```
 */
export function createAuthMiddleware(
  authService: AuthService,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  /**
   * 认证中间件钩子
   *
   * 执行逻辑：
   * - 检查 Authorization 头是否存在且以 "Bearer " 开头
   * - 提取 token 字符串
   * - 调用 authService.validateToken 验证
   * - 验证通过则将 payload 挂载到 request.user
   * - 验证失败则返回 401 响应并终止请求链
   */
  return async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // 获取 Authorization 请求头
    const authHeader = request.headers.authorization;

    // 检查 Authorization 头是否存在且格式正确
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: '缺少有效的认证凭证',
          trace_id: request.id,
        },
      });
      return;
    }

    // 提取 Bearer token
    const token = authHeader.slice(7); // "Bearer ".length === 7

    // 验证 token 签名与有效期
    const payload = authService.validateToken(token);

    if (!payload) {
      // Token 无效或已过期
      reply.status(401).send({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token 无效或已过期',
          trace_id: request.id,
        },
      });
      return;
    }

    // 验证通过，将用户信息附加到请求对象供下游使用
    request.user = payload;
  };
}
