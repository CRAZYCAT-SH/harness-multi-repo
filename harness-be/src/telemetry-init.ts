/**
 * OpenTelemetry SDK 初始化
 *
 * 配置 TracerProvider + LoggerProvider + MeterProvider，
 * 将追踪、日志、指标全部通过 OTLP HTTP 导出到 OTel Collector。
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

let sdk: NodeSDK | null = null;

if (otlpEndpoint) {
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: 'harness-demo-backend',
  });

  // 追踪导出器
  const traceExporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  });

  // 日志导出器
  const logExporter = new OTLPLogExporter({
    url: `${otlpEndpoint}/v1/logs`,
  });

  // 指标导出器
  const metricExporter = new OTLPMetricExporter({
    url: `${otlpEndpoint}/v1/metrics`,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    logRecordProcessor: new BatchLogRecordProcessor(logExporter),
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 5000, // 每 5 秒导出一次指标
    }),
  });

  sdk.start();
  console.log(`[telemetry] OTel SDK 已启动（traces + logs + metrics），导出到: ${otlpEndpoint}`);
} else {
  console.log('[telemetry] OTEL_EXPORTER_OTLP_ENDPOINT 未配置，遥测数据不导出');
}

process.on('SIGTERM', () => {
  sdk?.shutdown().catch(() => {});
});
