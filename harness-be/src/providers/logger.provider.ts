/**
 * 日志提供者实现
 *
 * 输出结构化 JSON 日志到 stdout，同时通过 OTel Logs API 发送到 Collector。
 * 每条日志自动附带当前活跃 Span 的 trace_id 和 span_id。
 */

import { trace, context } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import type { LoggerProvider } from './index.js';

/**
 * 创建日志提供者实例
 */
export function createLoggerProvider(serviceName: string, logLevel: string): LoggerProvider {
  const levels = ['debug', 'info', 'warn', 'error'];
  const minLevel = levels.indexOf(logLevel);

  // 获取 OTel Logger 实例（用于发送日志到 Collector）
  const otelLogger = logs.getLogger(serviceName);

  function shouldLog(level: string): boolean {
    return levels.indexOf(level) >= minLevel;
  }

  /** 将日志级别映射到 OTel SeverityNumber */
  function toSeverity(level: string): SeverityNumber {
    switch (level) {
      case 'debug': return SeverityNumber.DEBUG;
      case 'info': return SeverityNumber.INFO;
      case 'warn': return SeverityNumber.WARN;
      case 'error': return SeverityNumber.ERROR;
      default: return SeverityNumber.INFO;
    }
  }

  function log(level: string, message: string, ctx?: Record<string, unknown>): void {
    if (!shouldLog(level)) return;

    // 从 OpenTelemetry 活跃上下文提取追踪信息
    const activeSpan = trace.getSpan(context.active());
    const spanContext = activeSpan?.spanContext();

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: serviceName,
      message,
      trace_id: spanContext?.traceId,
      span_id: spanContext?.spanId,
      ...ctx,
    };

    // 1. 输出到 stdout（结构化 JSON）
    process.stdout.write(JSON.stringify(entry) + '\n');

    // 2. 通过 OTel Logs API 发送到 Collector
    otelLogger.emit({
      severityNumber: toSeverity(level),
      severityText: level.toUpperCase(),
      body: message,
      attributes: {
        service: serviceName,
        ...ctx as Record<string, string>,
      },
    });
  }

  return {
    info: (msg, ctx) => log('info', msg, ctx),
    warn: (msg, ctx) => log('warn', msg, ctx),
    error: (msg, ctx) => log('error', msg, ctx),
  };
}
