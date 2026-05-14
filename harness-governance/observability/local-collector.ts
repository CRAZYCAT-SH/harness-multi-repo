/**
 * 本地可观测性数据收集器（无 Docker 版本）
 *
 * 当 Docker 不可用时，提供一个轻量的 HTTP 服务器接收 OTLP 数据，
 * 将日志、指标、追踪写入 .worktree/telemetry/ 目录下的 JSON 文件。
 * AI 代理可直接读取这些文件来查询应用行为。
 *
 * 端点：
 * - POST /v1/traces — 接收追踪数据
 * - POST /v1/metrics — 接收指标数据
 * - POST /v1/logs — 接收日志数据
 * - GET /query/traces?traceId=xxx — 查询追踪
 * - GET /query/logs?level=error&limit=10 — 查询日志
 * - GET /query/metrics?name=xxx — 查询指标
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdirSync, appendFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(process.cwd(), '.worktree', 'telemetry');

// 确保数据目录存在
mkdirSync(DATA_DIR, { recursive: true });

const TRACES_FILE = join(DATA_DIR, 'traces.jsonl');
const LOGS_FILE = join(DATA_DIR, 'logs.jsonl');
const METRICS_FILE = join(DATA_DIR, 'metrics.jsonl');

/**
 * 读取请求体
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

/**
 * 查询 JSONL 文件中的记录
 */
function queryJsonl(file: string, filter: (record: Record<string, unknown>) => boolean, limit: number): unknown[] {
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean);
  const results: unknown[] = [];
  // 从末尾开始查找（最新的在后面）
  for (let i = lines.length - 1; i >= 0 && results.length < limit; i--) {
    try {
      const record = JSON.parse(lines[i]!) as Record<string, unknown>;
      if (filter(record)) {
        results.push(record);
      }
    } catch {
      // 跳过解析失败的行
    }
  }
  return results;
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://localhost`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 接收遥测数据
  if (req.method === 'POST') {
    const body = await readBody(req);
    const timestamp = new Date().toISOString();
    const record = JSON.stringify({ timestamp, data: body.slice(0, 10000) });

    if (url.pathname === '/v1/traces') {
      appendFileSync(TRACES_FILE, record + '\n');
      res.writeHead(200);
      res.end('{}');
      return;
    }
    if (url.pathname === '/v1/logs') {
      appendFileSync(LOGS_FILE, record + '\n');
      res.writeHead(200);
      res.end('{}');
      return;
    }
    if (url.pathname === '/v1/metrics') {
      appendFileSync(METRICS_FILE, record + '\n');
      res.writeHead(200);
      res.end('{}');
      return;
    }
  }

  // 查询接口（AI 代理使用）
  if (req.method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

    if (url.pathname === '/query/traces') {
      const traceId = url.searchParams.get('traceId');
      const results = queryJsonl(TRACES_FILE, (r) => {
        if (!traceId) return true;
        return JSON.stringify(r).includes(traceId);
      }, limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ results, total: results.length }));
      return;
    }

    if (url.pathname === '/query/logs') {
      const level = url.searchParams.get('level');
      const results = queryJsonl(LOGS_FILE, (r) => {
        if (!level) return true;
        return JSON.stringify(r).includes(`"level":"${level}"`);
      }, limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ results, total: results.length }));
      return;
    }

    if (url.pathname === '/query/metrics') {
      const results = queryJsonl(METRICS_FILE, () => true, limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ results, total: results.length }));
      return;
    }

    // 健康检查
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', dataDir: DATA_DIR }));
      return;
    }
  }

  res.writeHead(404);
  res.end('Not Found');
});

const port = parseInt(process.env.COLLECTOR_PORT ?? '4318', 10);
server.listen(port, () => {
  console.log(`[local-collector] 本地遥测收集器已启动: http://localhost:${port}`);
  console.log(`[local-collector] 数据目录: ${DATA_DIR}`);
  console.log(`[local-collector] 查询接口:`);
  console.log(`  GET /query/traces?traceId=xxx&limit=20`);
  console.log(`  GET /query/logs?level=error&limit=20`);
  console.log(`  GET /query/metrics?limit=20`);
});
