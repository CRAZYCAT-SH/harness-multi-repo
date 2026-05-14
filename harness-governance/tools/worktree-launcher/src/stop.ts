/**
 * Worktree Launcher Stop — 停止当前 worktree 的所有开发服务
 *
 * 停止由 pnpm dev 启动的所有进程并清理 .worktree/ 目录。
 * 入口命令：pnpm dev:stop
 *
 * 停止流程：
 * 1. 读取 .worktree/ports.json 获取当前配置
 * 2. 停止所有已启动的进程（占位）
 * 3. 清理 .worktree/ 目录
 *
 * @module worktree-launcher/stop
 */

import { resolve } from 'node:path';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import type { PortAllocation } from './port-allocator.js';

/** Worktree 配置信息（从 ports.json 读取） */
interface WorktreeConfig {
  /** worktree 绝对路径 */
  worktreePath: string;
  /** 各服务端口分配 */
  ports: PortAllocation;
  /** 启动时间（ISO 8601） */
  startedAt: string;
}

/**
 * 获取 .worktree 目录路径
 *
 * @param worktreePath - worktree 根目录路径
 * @returns .worktree 目录的绝对路径
 */
function getWorktreeDir(worktreePath: string): string {
  return resolve(worktreePath, '.worktree');
}

/**
 * 读取 .worktree/ports.json 配置文件
 *
 * @param worktreePath - worktree 根目录路径
 * @returns 解析后的配置对象，如果文件不存在则返回 null
 */
function readPortsJson(worktreePath: string): WorktreeConfig | null {
  const filePath = resolve(getWorktreeDir(worktreePath), 'ports.json');
  if (!existsSync(filePath)) {
    return null;
  }
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as WorktreeConfig;
}

/**
 * 清理 .worktree/ 目录
 *
 * 递归删除整个 .worktree 目录及其内容。
 *
 * @param worktreePath - worktree 根目录路径
 */
function cleanWorktreeDir(worktreePath: string): void {
  const dir = getWorktreeDir(worktreePath);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
    console.log(`[worktree-launcher] 已清理目录: ${dir}`);
  }
}

/**
 * 停止所有开发服务并清理资源
 *
 * 当前为占位实现，仅读取配置并清理目录。
 * 后续将实际终止前端、后端、可观测性栈进程。
 *
 * @returns 停止完成的 Promise
 */
export async function stop(): Promise<void> {
  const worktreePath = process.cwd();
  console.log(`[worktree-launcher] 当前 worktree 路径: ${worktreePath}`);

  // 读取端口配置
  const config = readPortsJson(worktreePath);
  if (!config) {
    console.log('[worktree-launcher] 未找到 .worktree/ports.json，可能没有正在运行的服务');
    return;
  }

  console.log(`[worktree-launcher] 读取到启动配置（启动时间: ${config.startedAt}）`);
  console.log('[worktree-launcher] 正在停止服务...');

  // TODO: 停止前端开发服务器
  console.log(`[worktree-launcher] 停止前端服务（端口 ${config.ports.frontend}）（占位）...`);

  // TODO: 停止后端 API 服务器
  console.log(`[worktree-launcher] 停止后端服务（端口 ${config.ports.backend}）（占位）...`);

  // TODO: 停止可观测性栈（Docker Compose down）
  console.log('[worktree-launcher] 停止可观测性栈（占位）...');

  // 清理 .worktree/ 目录
  cleanWorktreeDir(worktreePath);

  console.log('[worktree-launcher] 所有服务已停止，资源已清理 ✓');
}

stop().catch((err) => {
  console.error('[worktree-launcher] 停止失败:', err);
  process.exit(1);
});
