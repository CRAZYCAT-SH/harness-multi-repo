/**
 * 端口分配器 — 基于 worktree 路径哈希确定性分配端口
 *
 * 使用 MD5 哈希将 worktree 路径映射到一个基础端口，
 * 然后从基础端口开始顺序分配 6 个端口给各服务组件。
 * 如果某个端口已被占用，则顺序递增直到找到可用端口。
 *
 * @module port-allocator
 */

import { createHash } from 'node:crypto';
import { createServer } from 'node:net';

/**
 * 端口分配结果接口
 *
 * 包含前端、后端、可观测性栈各组件的端口号
 */
export interface PortAllocation {
  /** 前端开发服务器端口 */
  frontend: number;
  /** 后端 API 服务器端口 */
  backend: number;
  /** OpenTelemetry Collector 端口 */
  otelCollector: number;
  /** VictoriaLogs 端口 */
  victoriaLogs: number;
  /** VictoriaMetrics 端口 */
  victoriaMetrics: number;
  /** VictoriaTraces 端口 */
  victoriaTraces: number;
}

/** 端口合法范围下限 */
const PORT_MIN = 1024;
/** 端口合法范围上限 */
const PORT_MAX = 65535;
/** 基础端口起始偏移（避免常用低端口） */
const BASE_PORT_START = 3000;
/** 基础端口范围大小（确保 basePort + 5 不超过 65535） */
const BASE_PORT_RANGE = 60000;

/**
 * 基于 worktree 路径哈希确定性分配端口（同步版本）
 *
 * 对同一路径始终返回相同的基础端口组。
 * 不同路径的端口组互不重叠（在哈希无碰撞的前提下）。
 * 所有分配的端口在 1024–65535 范围内。
 *
 * @param worktreePath - 当前 worktree 的绝对路径
 * @returns 各服务组件的端口分配结果
 */
export function allocatePorts(worktreePath: string): PortAllocation {
  // 使用 MD5 哈希路径以获得确定性的基础端口
  const hash = createHash('md5').update(worktreePath).digest();
  const basePort = BASE_PORT_START + (hash.readUInt16BE(0) % 50000);

  // 间距为 10，避免服务占用多端口时冲突
  return {
    frontend: basePort,
    backend: basePort + 10,
    otelCollector: basePort + 20,   // gRPC 端口，HTTP = +21
    victoriaLogs: basePort + 30,
    victoriaMetrics: basePort + 40,
    victoriaTraces: basePort + 50,
  };
}

/**
 * 检测指定端口是否可用
 *
 * 尝试在该端口上创建 TCP 服务器，如果成功则端口可用。
 *
 * @param port - 要检测的端口号
 * @returns 如果端口可用返回 true，否则返回 false
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * 从指定端口开始，顺序查找下一个可用端口
 *
 * 如果起始端口被占用，则递增尝试直到找到可用端口或超出范围。
 *
 * @param startPort - 起始端口号
 * @returns 可用的端口号
 * @throws 当所有端口都被占用时抛出错误
 */
async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (port <= PORT_MAX) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }
  throw new Error(
    `[worktree-launcher] 无法找到可用端口：从 ${startPort} 到 ${PORT_MAX} 均被占用`
  );
}

/**
 * 基于 worktree 路径哈希分配端口（异步版本，含冲突检测）
 *
 * 在确定性分配的基础上，逐一检测端口是否被占用。
 * 如果某个端口被占用，则顺序递增直到找到可用端口。
 * 确保所有分配的端口互不重复且在合法范围内。
 *
 * @param worktreePath - 当前 worktree 的绝对路径
 * @returns 各服务组件的端口分配结果（已验证可用）
 */
export async function allocatePortsWithCheck(worktreePath: string): Promise<PortAllocation> {
  const base = allocatePorts(worktreePath);
  const services = ['frontend', 'backend', 'otelCollector', 'victoriaLogs', 'victoriaMetrics', 'victoriaTraces'] as const;

  const result: Record<string, number> = {};
  const usedPorts = new Set<number>();

  for (const service of services) {
    let candidatePort = base[service];

    // 确保端口在合法范围内
    if (candidatePort < PORT_MIN) {
      candidatePort = PORT_MIN;
    }

    // 查找可用且未被本次分配占用的端口
    let port = await findAvailablePort(candidatePort);
    while (usedPorts.has(port)) {
      port = await findAvailablePort(port + 1);
    }

    usedPorts.add(port);
    result[service] = port;

    // 如果实际端口与预期不同，记录日志
    if (port !== base[service]) {
      console.log(
        `[worktree-launcher] ${service} 端口 ${base[service]} 被占用，实际使用: ${port}`
      );
    }
  }

  return result as unknown as PortAllocation;
}
