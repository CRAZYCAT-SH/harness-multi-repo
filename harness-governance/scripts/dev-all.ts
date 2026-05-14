/**
 * 同时启动前后端开发服务的脚本
 *
 * 在 governance 目录下运行 `pnpm dev` 即可同时启动：
 * - 后端：harness-be (tsx watch src/app.ts)
 * - 前端：harness-fe (vite)
 *
 * 所有子进程的输出带有 [BE] / [FE] 前缀以便区分。
 * Ctrl+C 会同时终止所有子进程。
 *
 * 启动顺序：先启动后端，等待后端端口就绪后再启动前端，
 * 避免前端 proxy 连接后端失败。
 */

import { spawn, type ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import * as net from 'node:net';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// 后端默认端口
const BE_PORT = Number(process.env.PORT || '3000');

interface ServiceConfig {
  name: string;
  cwd: string;
  command: string;
  args: string[];
  color: string;
  env?: Record<string, string>;
}

const services: ServiceConfig[] = [
  {
    name: 'BE',
    cwd: path.join(ROOT, 'harness-be'),
    command: 'pnpm',
    args: ['dev'],
    color: '\x1b[36m', // 青色
    env: {
      HARNESS_START_SERVER: 'true',
      DATABASE_URL: ':memory:',
      JWT_SECRET: 'dev-secret-key-at-least-32-characters-long',
      PORT: String(BE_PORT),
      NODE_ENV: 'development',
    },
  },
  {
    name: 'FE',
    cwd: path.join(ROOT, 'harness-fe'),
    command: 'pnpm',
    args: ['dev'],
    color: '\x1b[35m', // 紫色
    env: {
      VITE_BACKEND_PORT: String(BE_PORT),
    },
  },
];

const RESET = '\x1b[0m';
const processes: ChildProcess[] = [];

function prefixLines(prefix: string, color: string, data: Buffer) {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      process.stdout.write(`${color}[${prefix}]${RESET} ${line}\n`);
    }
  }
}

function startService(config: ServiceConfig): ChildProcess {
  const child = spawn(config.command, config.args, {
    cwd: config.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env, ...config.env },
  });

  child.stdout?.on('data', (data: Buffer) => prefixLines(config.name, config.color, data));
  child.stderr?.on('data', (data: Buffer) => prefixLines(config.name, config.color, data));

  child.on('exit', (code) => {
    console.log(`${config.color}[${config.name}]${RESET} 进程退出，退出码: ${code}`);
  });

  return child;
}

/**
 * 等待指定端口可连接
 */
function waitForPort(port: number, timeout = 15000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      if (Date.now() - start > timeout) {
        reject(new Error(`等待端口 ${port} 超时 (${timeout}ms)`));
        return;
      }
      const socket = net.createConnection({ port, host: '127.0.0.1' });
      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        setTimeout(tryConnect, 300);
      });
    }
    tryConnect();
  });
}

// 启动所有服务
async function main() {
  console.log('\x1b[32m[DEV]\x1b[0m 同时启动前后端开发服务...\n');

  // 先启动后端
  const beConfig = services[0]!;
  const beChild = startService(beConfig);
  processes.push(beChild);
  console.log(`${beConfig.color}[${beConfig.name}]${RESET} 已启动 (端口: ${BE_PORT})`);

  // 等待后端端口就绪
  try {
    await waitForPort(BE_PORT);
    console.log(`\x1b[32m[DEV]\x1b[0m 后端已就绪 (端口 ${BE_PORT})\n`);
  } catch {
    console.error('\x1b[31m[DEV]\x1b[0m 后端启动超时，仍然继续启动前端...\n');
  }

  // 再启动前端
  const feConfig = services[1]!;
  const feChild = startService(feConfig);
  processes.push(feChild);
  console.log(`${feConfig.color}[${feConfig.name}]${RESET} 已启动\n`);
}

// 优雅退出：Ctrl+C 时终止所有子进程
function cleanup() {
  console.log('\n\x1b[32m[DEV]\x1b[0m 正在停止所有服务...');
  for (const child of processes) {
    child.kill('SIGTERM');
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

main().catch((err) => {
  console.error('\x1b[31m[DEV]\x1b[0m 启动失败:', err);
  cleanup();
});
