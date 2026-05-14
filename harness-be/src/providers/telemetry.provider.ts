/**
 * 遥测提供者实现
 *
 * 基于 @opentelemetry/api 实现 Span 创建与指标记录。
 * Span 命名遵循 service.domain.operation 约定。
 * 指标通过 OTel Metrics API 记录，由 SDK 定期导出到 Collector。
 */

import { trace, metrics, type Tracer } from '@opentelemetry/api';
import type { TelemetryProvider, Span } from './index.js';

/**
 * 创建遥测提供者实例
 */
export function createTelemetryProvider(serviceName: string): TelemetryProvider {
  const tracer: Tracer = trace.getTracer(serviceName);
  const meter = metrics.getMeter(serviceName);

  // 预创建常用指标
  const httpRequestCounter = meter.createCounter('http_requests_total', {
    description: 'HTTP 请求总数',
  });
  const httpDurationHistogram = meter.createHistogram('http_request_duration_seconds', {
    description: 'HTTP 请求延迟（秒）',
  });

  return {
    startSpan(name: string, attributes?: Record<string, string>): Span {
      const span = tracer.startSpan(name);
      if (attributes) {
        Object.entries(attributes).forEach(([k, v]) => span.setAttribute(k, v));
      }
      return {
        setAttribute(key, value) { span.setAttribute(key, value); },
        recordException(error) { span.recordException(error); },
        end() { span.end(); },
      };
    },

    recordMetric(name: string, value: number, labels?: Record<string, string>): void {
      // 根据指标名称路由到对应的 OTel 指标
      if (name === 'http_requests_total') {
        httpRequestCounter.add(value, labels);
      } else if (name === 'http_request_duration_seconds') {
        httpDurationHistogram.record(value, labels);
      } else {
        // 通用计数器
        const counter = meter.createCounter(name);
        counter.add(value, labels);
      }
    },
  };
}
