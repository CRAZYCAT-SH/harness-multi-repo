/**
 * Fastify 应用入口
 *
 * 本文件是后端服务的完整启动入口，负责：
 * 1. 解析环境变量
 * 2. 初始化所有 Providers（db、auth、logger、telemetry、time、random）
 * 3. 运行数据库迁移
 * 4. 创建域 Repos 和 Services
 * 5. 创建 Fastify 实例并配置中间件
 * 6. 注册路由（Auth、Task、Health、Metrics）
 * 7. 启动 HTTP 服务器
 *
 * 同时导出 buildApp 函数供测试使用（创建应用但不启动监听）。
 *
 * @module app
 */

// OTel SDK 必须在其他代码之前初始化
import './telemetry-init.js';

import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trace, context } from '@opentelemetry/api';

import { parseEnv } from './boundary/env.schema.js';
import { createDatabaseProvider } from './providers/db.provider.js';
import { createAuthProvider } from './providers/auth.provider.js';
import { createLoggerProvider } from './providers/logger.provider.js';
import { createTelemetryProvider } from './providers/telemetry.provider.js';
import { createTimeProvider } from './providers/time.provider.js';
import { createRandomProvider } from './providers/random.provider.js';
import { runMigrations } from './migrations/runner.js';
import { createAuthRepo } from './domains/auth/repo/auth.repo.js';
import { createAuthService } from './domains/auth/service/auth.service.js';
import { createAuthRoutes } from './domains/auth/runtime/auth.runtime.js';
import { createTaskRepo } from './domains/task/repo/task.repo.js';
import { createTaskService } from './domains/task/service/task.service.js';
import { createTaskRoutes } from './domains/task/runtime/task.runtime.js';
import { AppError } from './domains/shared/types/errors.js';
import type { Providers } from './providers/index.js';

/** 当前文件所在目录（ESM 环境下替代 __dirname） */
const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// 认证中间件
// ============================================================

/**
 * 创建认证中间件
 *
 * 从请求头 Authorization: Bearer <token> 中提取 JWT，
 * 验证签名与有效期，将解码后的 user_id 附加到 request 对象。
 * 验证失败时返回 401 错误响应。
 *
 * @param providers - Providers 集合（使用 auth.verifyToken）
 * @returns Fastify preHandler 钩子函数
 */
function createAuthMiddleware(providers: Providers) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: '缺少认证凭证',
          trace_id: getTraceId(),
        },
      });
      return;
    }

    const token = authHeader.slice(7);
    const payload = providers.auth.verifyToken(token);

    if (!payload) {
      reply.status(401).send({
        error: {
          code: 'TOKEN_EXPIRED',
          message: '认证凭证无效或已过期',
          trace_id: getTraceId(),
        },
      });
      return;
    }

    // 将用户 ID 附加到 request 对象
    (request as FastifyRequest & { userId: string }).userId = payload.user_id;
  };
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 从 OpenTelemetry 活跃上下文获取 trace_id
 *
 * @returns 当前活跃 Span 的 trace_id，无活跃 Span 时返回 'unknown'
 */
function getTraceId(): string {
  const activeSpan = trace.getSpan(context.active());
  return activeSpan?.spanContext().traceId ?? 'unknown';
}

// ============================================================
// 应用构建函数
// ============================================================

/**
 * 构建 Fastify 应用实例（不启动监听）
 *
 * 完成所有初始化工作：环境变量解析、Provider 创建、数据库迁移、
 * 域服务实例化、路由注册、错误处理器配置。
 * 返回就绪的 Fastify 实例，供测试或手动启动使用。
 *
 * @returns 配置完成的 Fastify 实例
 */
export async function buildApp(): Promise<FastifyInstance> {
  // 1. 解析环境变量
  const env = parseEnv();

  // 2. 初始化 Providers
  const db = await createDatabaseProvider(env.DATABASE_URL);
  const auth = createAuthProvider(env.JWT_SECRET, env.JWT_EXPIRES_IN);
  const logger = createLoggerProvider('harness-demo-backend', env.LOG_LEVEL);
  const telemetry = createTelemetryProvider('harness-demo-backend');
  const time = createTimeProvider();
  const random = createRandomProvider();

  const providers: Providers = { db, auth, logger, telemetry, time, random };

  // 3. 运行数据库迁移
  const migrationsDir = join(__dirname, '../migrations');
  runMigrations(db, migrationsDir);

  // 4. 创建域 Repos 和 Services
  const authRepo = createAuthRepo(db);
  const authService = createAuthService(authRepo, providers);

  const taskRepo = createTaskRepo(db);
  const taskService = createTaskService(taskRepo, providers);

  // 5. 创建 Fastify 实例
  const app = Fastify({
    logger: false, // 使用自定义结构化日志，不使用 Fastify 内置 logger
  });

  // 启用 CORS
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (request.method === 'OPTIONS') {
      reply.status(204).send();
    }
  });

  // 请求追踪钩子：为每个请求创建 OTel Span
  app.addHook('onRequest', async (request) => {
    const spanName = `${request.method} ${request.url.split('?')[0]}`;
    const span = trace.getTracer('harness-demo-backend').startSpan(spanName, {
      attributes: {
        'http.method': request.method,
        'http.url': request.url,
        'http.route': request.url.split('?')[0],
      },
    });
    // 将 span 存储在 request 对象上，供后续钩子使用
    (request as unknown as Record<string, unknown>).__span = span;
  });

  // 请求日志钩子：记录 trace_id、span_id、method、route、status、duration
  app.addHook('onResponse', async (request, reply) => {
    // 结束请求 span
    const span = (request as unknown as Record<string, unknown>).__span as import('@opentelemetry/api').Span | undefined;
    if (span) {
      span.setAttribute('http.status_code', reply.statusCode);
      span.end();
    }

    const activeSpan = trace.getSpan(context.active());
    const spanContext = activeSpan?.spanContext() ?? span?.spanContext();

    logger.info('HTTP 请求完成', {
      trace_id: spanContext?.traceId,
      span_id: spanContext?.spanId,
      'http.method': request.method,
      'http.route': request.url,
      'http.status_code': reply.statusCode,
      duration_ms: reply.elapsedTime,
    });

    // 记录 HTTP 指标
    const route = request.url.split('?')[0] ?? request.url;
    telemetry.recordMetric('http_requests_total', 1, {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    });
    telemetry.recordMetric('http_request_duration_seconds', (reply.elapsedTime ?? 0) / 1000, {
      method: request.method,
      route,
    });
  });

  // x-trace-id 响应头注入
  app.addHook('onSend', async (_request, reply, _payload) => {
    const traceId = getTraceId();
    reply.header('x-trace-id', traceId);
  });

  // 6. 统一错误处理器
  app.setErrorHandler(async (error, request, reply) => {
    const traceId = getTraceId();

    // AppError：业务异常，转换为标准 ErrorResponse 格式
    if (error instanceof AppError) {
      // 4xx 错误不记录 ERROR 级别日志
      if (error.statusCode >= 500) {
        logger.error('服务器内部错误', {
          trace_id: traceId,
          error_code: error.code,
          error_message: error.message,
          stack: error.stack,
          'http.method': request.method,
          'http.route': request.url,
        });
      }

      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          trace_id: traceId,
        },
      });
    }

    // 未知错误：转换为 500 INTERNAL_ERROR，记录完整堆栈
    logger.error('未预期的服务器错误', {
      trace_id: traceId,
      error_message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      'http.method': request.method,
      'http.route': request.url,
    });

    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
        trace_id: traceId,
      },
    });
  });

  // 7. 注册路由

  // Auth 路由（公开，无需认证）
  const authRoutes = createAuthRoutes(authService);
  app.register(authRoutes);

  // Task 路由（需认证）
  const authMiddleware = createAuthMiddleware(providers);
  const taskRoutes = createTaskRoutes(taskService, authMiddleware);
  app.register(taskRoutes);

  // 健康检查端点
  app.get('/health', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Prometheus 指标端点（占位）
  app.get('/metrics', async (_request, reply) => {
    // 占位实现：后续接入 OpenTelemetry Metrics SDK 后输出 Prometheus 格式
    reply.header('Content-Type', 'text/plain; charset=utf-8');
    return reply.status(200).send('# HELP http_requests_total Total HTTP requests\n# TYPE http_requests_total counter\n');
  });

  return app;
}

// ============================================================
// 服务器启动
// ============================================================

/**
 * 启动 HTTP 服务器
 *
 * 构建应用实例后在配置的 PORT 上开始监听。
 * 启动失败时输出错误信息并以非零状态退出。
 */
async function start(): Promise<void> {
  // 预先解析环境变量获取 PORT（buildApp 内部也会解析，但此处需要端口信息）
  const env = parseEnv();
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    process.stdout.write(`服务器已启动，监听端口 ${env.PORT}\n`);
  } catch (err) {
    process.stderr.write(`服务器启动失败: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

// 仅在直接运行时启动服务器（非测试导入时不自动启动）
if (process.env.HARNESS_START_SERVER === 'true') {
  start();
}

export default buildApp;
