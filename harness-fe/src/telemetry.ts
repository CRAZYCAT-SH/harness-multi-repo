/**
 * 前端 OpenTelemetry 遥测初始化模块
 *
 * 使用 OpenTelemetry Browser SDK 追踪前端关键路径：
 * - 页面加载
 * - 路由切换
 * - API 调用
 *
 * 通过 OTLP HTTP 协议将追踪数据导出到 OpenTelemetry Collector。
 * 在 main.tsx 中调用 initTelemetry() 完成初始化。
 *
 * @module telemetry
 */
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { trace } from '@opentelemetry/api';

/**
 * 初始化前端 OpenTelemetry 遥测
 *
 * 配置 WebTracerProvider 并注册 OTLP HTTP 导出器，
 * 将追踪数据发送到 OTel Collector。
 * 初始化失败不阻塞应用启动。
 */
export function initTelemetry(): void {
  try {
    const collectorUrl = `${window.location.origin}/api/v1/traces`;
    const exporter = new OTLPTraceExporter({
      url: collectorUrl,
    });

    const provider = new WebTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    provider.register();
  } catch {
    // 遥测初始化失败不应阻塞应用启动
    console.warn('[telemetry] OpenTelemetry 初始化失败，遥测功能不可用');
  }
}

/**
 * 获取前端应用的 Tracer 实例
 *
 * 用于在业务代码中手动创建 span，追踪页面加载、路由切换、API 调用等关键路径。
 *
 * @returns OpenTelemetry Tracer 实例
 */
export function getTracer() {
  return trace.getTracer('harness-demo-frontend');
}
