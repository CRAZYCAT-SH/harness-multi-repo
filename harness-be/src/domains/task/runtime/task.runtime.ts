/**
 * Task 域 Runtime 层（路由注册）
 *
 * 以 Fastify 插件模式注册任务管理相关的 HTTP 路由：
 * - GET /api/v1/tasks — 分页查询任务列表
 * - POST /api/v1/tasks — 创建新任务
 * - PATCH /api/v1/tasks/:id — 更新任务
 * - DELETE /api/v1/tasks/:id — 删除任务
 *
 * 所有路由均需认证（通过 authMiddleware 保护），
 * 请求数据通过 safeParseBody / safeParseBody 进行边界解析。
 *
 * 依赖方向：types → config → repo → service → runtime（本层）
 *
 * @module task.runtime
 */

import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import type { TaskService } from '../service/task.service.js';
import { CreateTaskSchema, UpdateTaskSchema, TaskQuerySchema } from '../types/index.js';
import { safeParseBody } from '../../../boundary/parse-request.js';
import { AppError } from '../../shared/types/errors.js';

/**
 * 认证中间件类型
 *
 * 从请求头中提取并验证 Bearer token，
 * 将解码后的用户信息附加到 request 对象上。
 */
export type AuthMiddleware = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

/**
 * Task 路由插件工厂
 *
 * 接收 TaskService 和认证中间件，返回 Fastify 插件函数。
 * 插件内注册所有任务管理端点，均受认证中间件保护。
 *
 * @param taskService - Task 域 Service 层实例
 * @param authMiddleware - 认证中间件（校验 Bearer token）
 * @returns Fastify 插件回调函数
 */
export function createTaskRoutes(
  taskService: TaskService,
  authMiddleware: AuthMiddleware,
): FastifyPluginCallback {
  /**
   * Fastify 插件：注册 Task 域路由
   */
  const taskRoutes: FastifyPluginCallback = (fastify: FastifyInstance, _opts, done) => {
    /**
     * GET /api/v1/tasks
     *
     * 分页查询当前用户的任务列表。
     * 支持 status、priority 过滤和 search 关键词搜索。
     */
    fastify.get('/api/v1/tasks', { preHandler: authMiddleware }, async (request, reply) => {
      // 解析查询参数
      const parseResult = safeParseBody(TaskQuerySchema, request.query);
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

      const userId = (request as FastifyRequest & { userId: string }).userId;
      // Zod .default() 保证解析成功后 page 和 page_size 一定存在
      const query = parseResult.data as import('../types/index.js').TaskQuery;
      const result = taskService.list(userId, query);
      return reply.status(200).send(result);
    });

    /**
     * POST /api/v1/tasks
     *
     * 创建新任务。
     * - title 必填，1-200 字符
     * - priority 默认 'normal'
     * - due_date 不能早于当前时间
     * - parent_id 可选，指定父任务
     */
    fastify.post('/api/v1/tasks', { preHandler: authMiddleware }, async (request, reply) => {
      const parseResult = safeParseBody(CreateTaskSchema, request.body);
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
        const userId = (request as FastifyRequest & { userId: string }).userId;
        // Zod .default() 保证解析成功后 priority 一定存在
        const input = parseResult.data as import('../types/index.js').CreateTaskInput;
        const task = taskService.create(userId, input);
        return reply.status(201).send(task);
      } catch (err) {
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
        throw err;
      }
    });

    /**
     * GET /api/v1/tasks/:id/subtasks
     *
     * 获取指定任务的子任务列表。
     */
    fastify.get('/api/v1/tasks/:id/subtasks', { preHandler: authMiddleware }, async (request, reply) => {
      try {
        const userId = (request as FastifyRequest & { userId: string }).userId;
        const { id } = request.params as { id: string };
        const subtasks = taskService.getSubtasks(userId, id);
        return reply.status(200).send(subtasks);
      } catch (err) {
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
        throw err;
      }
    });

    /**
     * PATCH /api/v1/tasks/:id
     *
     * 更新指定任务的字段。
     * 仅允许更新属于当前用户的任务。
     */
    fastify.patch('/api/v1/tasks/:id', { preHandler: authMiddleware }, async (request, reply) => {
      const parseResult = safeParseBody(UpdateTaskSchema, request.body);
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
        const userId = (request as FastifyRequest & { userId: string }).userId;
        const { id } = request.params as { id: string };
        const task = taskService.update(userId, id, parseResult.data);
        return reply.status(200).send(task);
      } catch (err) {
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
        throw err;
      }
    });

    /**
     * DELETE /api/v1/tasks/:id
     *
     * 删除指定任务。
     * 仅允许删除属于当前用户的任务。
     */
    fastify.delete('/api/v1/tasks/:id', { preHandler: authMiddleware }, async (request, reply) => {
      try {
        const userId = (request as FastifyRequest & { userId: string }).userId;
        const { id } = request.params as { id: string };
        taskService.delete(userId, id);
        return reply.status(204).send();
      } catch (err) {
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
        throw err;
      }
    });

    done();
  };

  return taskRoutes;
}
