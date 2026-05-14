/**
 * Worktree Launcher — Worktree 隔离的开发环境启动器
 *
 * 统一协调启动前端、后端、可观测性栈，基于 worktree 路径哈希分配端口。
 * 入口命令：pnpm dev
 *
 * 启动流程：
 * 1. 获取当前 worktree 路径
 * 2. 基于路径哈希分配端口（含冲突检测）
 * 3. 将端口信息写入 .worktree/ports.json
 * 4. 启动后端 API 服务器
 * 5. 启动前端 Vite 开发服务器
 * 6. 尝试启动可观测性栈（Docker Compose，失败不阻塞）
 *
 * @module worktree-launcher
 */

import { resolve, join } from 'node:path';
import { mkdirSync, writeFileSync, existsSync, readFileSync, appendFileSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { allocatePortsWithCheck, type PortAllocation } from './port-allocator.js';

/** Worktree 配置信息 */
interface WorktreeConfig {
  /** worktree 绝对路径 */
  worktreePath: string;
  /** 各服务端口分配 */
  ports: PortAllocation;
  /** 启动时间（ISO 8601） */
  startedAt: string;
  /** 各进程 PID（用于 stop 时终止） */
  pids: Record<string, number>;
}

/** 管理的子进程列表 */
const childProcesses: ChildProcess[] = [];

/**
 * 获取 .worktree 目录路径
 */
function getWorktreeDir(worktreePath: string): string {
  return resolve(worktreePath, '.worktree');
}

/**
 * 确保 .worktree 目录存在
 */
function ensureWorktreeDir(worktreePath: string): void {
  const dir = getWorktreeDir(worktreePath);
  mkdirSync(dir, { recursive: true });
}

/**
 * 将配置写入 .worktree/ports.json
 */
function writePortsJson(config: WorktreeConfig): void {
  const filePath = resolve(getWorktreeDir(config.worktreePath), 'ports.json');
  writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 加载 .env 文件为环境变量对象
 */
function loadEnvFile(worktreePath: string): Record<string, string> {
  const envPath = join(worktreePath, '.env');
  const env: Record<string, string> = {};
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        env[key] = value;
      }
    }
  }
  return env;
}

/**
 * 启动子进程并管理其生命周期
 */
function spawnService(
  name: string,
  command: string,
  args: string[],
  options: { cwd: string; env?: Record<string, string> },
): ChildProcess {
  const mergedEnv = { ...process.env, ...options.env };
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: mergedEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  child.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      console.log(`[${name}] ${line}`);
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      console.error(`[${name}] ${line}`);
    }
  });

  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[${name}] 进程退出，退出码: ${code}`);
    }
  });

  childProcesses.push(child);
  return child;
}

/**
 * 优雅关闭所有子进程
 */
function shutdownAll(): void {
  console.log('\n[worktree-launcher] 正在停止所有服务...');
  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
  setTimeout(() => {
    for (const child of childProcesses) {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }
    process.exit(0);
  }, 3000);
}

/**
 * 启动所有开发服务
 */
export async function start(): Promise<void> {
  const worktreePath = process.cwd();
  console.log(`[worktree-launcher] 当前 worktree: ${worktreePath}`);

  // 1. 分配端口
  console.log('[worktree-launcher] 正在分配端口...');
  const ports = await allocatePortsWithCheck(worktreePath);

  console.log('[worktree-launcher] 端口分配完成:');
  console.log(`  前端:            http://localhost:${ports.frontend}`);
  console.log(`  后端:            http://localhost:${ports.backend}`);
  console.log(`  OTel Collector:  localhost:${ports.otelCollector}`);
  console.log(`  VictoriaLogs:    localhost:${ports.victoriaLogs}`);
  console.log(`  VictoriaMetrics: localhost:${ports.victoriaMetrics}`);
  console.log(`  VictoriaTraces:  localhost:${ports.victoriaTraces}`);

  // 2. 确保 .worktree 目录存在
  ensureWorktreeDir(worktreePath);

  // 3. 加载 .env 文件
  const envVars = loadEnvFile(worktreePath);

  // 4. 启动后端
  console.log('[worktree-launcher] 启动后端 API...');
  const backendEnv = {
    ...envVars,
    PORT: String(ports.backend),
    HARNESS_START_SERVER: 'true',
    OTEL_EXPORTER_OTLP_ENDPOINT: `http://localhost:${ports.otelCollector + 1}`,
  };
  const backendProcess = spawnService(
    'backend',
    'npx',
    ['tsx', 'src/app.ts'],
    { cwd: join(worktreePath, 'backend'), env: backendEnv },
  );

  // 将后端结构化日志同步写入遥测数据目录（供 AI 代理查询）
  const telemetryDir = resolve(worktreePath, '.worktree', 'telemetry');
  mkdirSync(telemetryDir, { recursive: true });
  backendProcess.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.startsWith('{')) {
        try {
          appendFileSync(resolve(telemetryDir, 'logs.jsonl'), line + '\n');
        } catch { /* 忽略 */ }
      }
    }
  });

  // 5. 启动前端（Vite，使用分配的端口，代理到后端端口）
  console.log('[worktree-launcher] 启动前端 Vite...');
  const frontendEnv = {
    VITE_BACKEND_PORT: String(ports.backend),
  };
  const frontendProcess = spawnService(
    'frontend',
    'npx',
    ['vite', '--port', String(ports.frontend), '--strictPort'],
    { cwd: join(worktreePath, 'frontend'), env: frontendEnv },
  );

  // 6. 启动可观测性栈（优先 Docker Compose，降级到本地收集器）
  console.log('[worktree-launcher] 启动可观测性栈...');
  const collectorPort = ports.otelCollector + 1; // HTTP 端口
  let useDocker = false;
  try {
    const { execSync } = await import('node:child_process');
    execSync('docker info', { stdio: 'ignore', timeout: 5000 });
    useDocker = true;
  } catch {
    useDocker = false;
  }

  if (useDocker) {
    console.log('[worktree-launcher] Docker 可用，启动 Docker Compose 可观测性栈...');
    const otelGrpcPort = ports.otelCollector;
    const otelHttpPort = ports.otelCollector + 1;
    console.log(`  OTel Collector:  gRPC=${otelGrpcPort}, HTTP=${otelHttpPort}`);
    console.log(`  VictoriaLogs:    ${ports.victoriaLogs}`);
    console.log(`  VictoriaMetrics: ${ports.victoriaMetrics}`);
    console.log(`  VictoriaTraces:  ${ports.victoriaTraces}`);
    const observabilityEnv = {
      OTEL_GRPC_PORT: String(otelGrpcPort),
      OTEL_HTTP_PORT: String(otelHttpPort),
      VICTORIA_LOGS_PORT: String(ports.victoriaLogs),
      VICTORIA_METRICS_PORT: String(ports.victoriaMetrics),
      VICTORIA_TRACES_PORT: String(ports.victoriaTraces),
    };
    spawnService(
      'observability',
      'docker',
      ['compose', '-f', join(worktreePath, 'observability', 'docker-compose.yaml'), 'up'],
      { cwd: worktreePath, env: observabilityEnv },
    );
  } else {
    console.log('[worktree-launcher] Docker 不可用，启动本地遥测收集器...');
    spawnService(
      'collector',
      'npx',
      ['tsx', join(worktreePath, 'observability', 'local-collector.ts')],
      { cwd: worktreePath, env: { COLLECTOR_PORT: String(collectorPort) } },
    );
  }

  // 7. 写入配置（含 PID）
  const config: WorktreeConfig = {
    worktreePath,
    ports,
    startedAt: new Date().toISOString(),
    pids: {
      backend: backendProcess.pid ?? 0,
      frontend: frontendProcess.pid ?? 0,
    },
  };
  writePortsJson(config);

  console.log('[worktree-launcher] ✓ 开发环境启动完成');
  console.log(`[worktree-launcher] 前端: http://localhost:${ports.frontend}`);
  console.log(`[worktree-launcher] 后端: http://localhost:${ports.backend}`);
  console.log('[worktree-launcher] 按 Ctrl+C 停止所有服务\n');

  // 注册退出信号处理
  process.on('SIGINT', shutdownAll);
  process.on('SIGTERM', shutdownAll);
}

start().catch((err) => {
  console.error('[worktree-launcher] 启动失败:', err);
  process.exit(1);
});
