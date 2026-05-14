/**
 * E2E 编排脚本
 *
 * 实现本地代码优先、Docker 镜像兜底的 E2E 测试编排。
 * 动态分配端口，启动可观测性栈，解析前后端服务，执行 Playwright 测试，
 * 查询可观测性数据并生成结构化报告。
 *
 * 用法:
 *   npx tsx scripts/e2e-orchestrator.ts [options]
 *
 * 选项:
 *   --fe-image         强制前端使用 Docker 镜像
 *   --be-image         强制后端使用 Docker 镜像
 *   --no-observability 跳过可观测性栈（快速模式）
 *   --keep-infra       测试完成后保留可观测性栈
 */

import * as net from 'node:net';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawn, ChildProcess } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── 类型定义 ───────────────────────────────────────────────────────────────

interface PortsConfig {
  frontend: number;
  backend: number;
  otelGrpc: number;
  otelHttp: number;
  victoriaLogs: number;
  victoriaMetrics: number;
  victoriaTraces: number;
}

interface CLIArgs {
  feImage: boolean;
  beImage: boolean;
  noObservability: boolean;
  keepInfra: boolean;
}

interface ServiceResolution {
  name: 'frontend' | 'backend';
  localPath: string;
  imageName: string;
  installCmd: string;
  buildCmd: string;
  startCmd: string;
  dockerRunArgs: string[];
  port: number;
  healthCheckUrl: string;
  otelEnv: Record<string, string>;
}

interface E2EReport {
  /** Playwright 测试结果 */
  testResults: { passed: number; failed: number; skipped: number };
  /** 从 VictoriaLogs 查询的错误日志 */
  errorLogs: Array<{ timestamp: string; message: string; service: string; traceId?: string }>;
  /** 从 VictoriaMetrics 查询的 HTTP 指标 */
  httpMetrics: { totalRequests: number; errorRate: number; p99Latency: number };
  /** 失败用例关联的 trace_id */
  failedTraces: Array<{ testName: string; traceId: string; spans: number }>;
}

// ─── 全局状态 ───────────────────────────────────────────────────────────────

const runningProcesses: ChildProcess[] = [];
const ROOT_DIR = path.resolve(__dirname, '..');
const WORKTREE_DIR = path.join(ROOT_DIR, '.worktree');

// ─── 参数解析 ───────────────────────────────────────────────────────────────

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  return {
    feImage: args.includes('--fe-image'),
    beImage: args.includes('--be-image'),
    noObservability: args.includes('--no-observability'),
    keepInfra: args.includes('--keep-infra'),
  };
}

// ─── 端口分配 ───────────────────────────────────────────────────────────────

/**
 * 使用 net.createServer 找到一个可用端口
 */
function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('无法获取端口')));
      }
    });
    server.on('error', reject);
  });
}

/**
 * 分配所有需要的动态端口
 */
async function allocatePorts(): Promise<PortsConfig> {
  const ports: PortsConfig = {
    frontend: await findAvailablePort(),
    backend: await findAvailablePort(),
    otelGrpc: await findAvailablePort(),
    otelHttp: await findAvailablePort(),
    victoriaLogs: await findAvailablePort(),
    victoriaMetrics: await findAvailablePort(),
    victoriaTraces: await findAvailablePort(),
  };

  // 确保 .worktree 目录存在
  if (!fs.existsSync(WORKTREE_DIR)) {
    fs.mkdirSync(WORKTREE_DIR, { recursive: true });
  }

  // 写入 ports.json
  const portsFile = path.join(WORKTREE_DIR, 'ports.json');
  fs.writeFileSync(portsFile, JSON.stringify({ ports }, null, 2));
  console.log(`✅ 端口已分配并写入 ${portsFile}`);
  console.log(`   frontend: ${ports.frontend}`);
  console.log(`   backend: ${ports.backend}`);
  console.log(`   otelGrpc: ${ports.otelGrpc}`);
  console.log(`   otelHttp: ${ports.otelHttp}`);
  console.log(`   victoriaLogs: ${ports.victoriaLogs}`);
  console.log(`   victoriaMetrics: ${ports.victoriaMetrics}`);
  console.log(`   victoriaTraces: ${ports.victoriaTraces}`);

  return ports;
}

// ─── 可观测性栈 ─────────────────────────────────────────────────────────────

/**
 * 启动可观测性栈（OTel Collector + VictoriaLogs + VictoriaMetrics + VictoriaTraces）
 */
function startObservability(ports: PortsConfig): void {
  console.log('\n🔭 启动可观测性栈...');

  const composeFile = path.join(ROOT_DIR, 'observability', 'docker-compose.yaml');
  if (!fs.existsSync(composeFile)) {
    console.warn('⚠️  observability/docker-compose.yaml 不存在，跳过可观测性栈');
    return;
  }

  const env = {
    ...process.env,
    OTEL_GRPC_PORT: String(ports.otelGrpc),
    OTEL_HTTP_PORT: String(ports.otelHttp),
    VICTORIA_LOGS_PORT: String(ports.victoriaLogs),
    VICTORIA_METRICS_PORT: String(ports.victoriaMetrics),
    VICTORIA_TRACES_PORT: String(ports.victoriaTraces),
  };

  execSync(
    `docker-compose -f "${composeFile}" up -d`,
    { env, stdio: 'inherit' }
  );

  console.log('✅ 可观测性栈已启动');
}

// ─── 服务解析 ───────────────────────────────────────────────────────────────

/**
 * 解析服务：检测本地路径是否存在，决定使用本地构建还是 Docker 镜像
 */
function resolveService(
  name: 'frontend' | 'backend',
  ports: PortsConfig,
  forceImage: boolean
): ServiceResolution {
  const config: Record<'frontend' | 'backend', Omit<ServiceResolution, 'otelEnv'>> = {
    frontend: {
      name: 'frontend',
      localPath: path.resolve(ROOT_DIR, '..', 'harness-fe'),
      imageName: 'ghcr.io/harness-demo/harness-fe:latest',
      installCmd: 'pnpm install',
      buildCmd: '',
      startCmd: `pnpm dev --port ${ports.frontend}`,
      dockerRunArgs: ['-p', `${ports.frontend}:5173`],
      port: ports.frontend,
      healthCheckUrl: `http://localhost:${ports.frontend}`,
    },
    backend: {
      name: 'backend',
      localPath: path.resolve(ROOT_DIR, '..', 'harness-be'),
      imageName: 'ghcr.io/harness-demo/harness-be:latest',
      installCmd: 'pnpm install',
      buildCmd: 'pnpm build',
      startCmd: `node dist/app.js`,
      dockerRunArgs: ['-p', `${ports.backend}:3001`],
      port: ports.backend,
      healthCheckUrl: `http://localhost:${ports.backend}/health`,
    },
  };

  const svc = config[name];

  // 注入 OTel 环境变量
  const otelEnv: Record<string, string> = {
    OTEL_EXPORTER_OTLP_ENDPOINT: `http://localhost:${ports.otelHttp}`,
    OTEL_SERVICE_NAME: `harness-demo-${name}`,
    OTEL_TRACES_EXPORTER: 'otlp',
    OTEL_METRICS_EXPORTER: 'otlp',
    OTEL_LOGS_EXPORTER: 'otlp',
  };

  // 前端需要知道后端端口以配置 proxy
  if (name === 'frontend') {
    otelEnv['VITE_BACKEND_PORT'] = String(ports.backend);
  }

  return { ...svc, otelEnv };
}

/**
 * 启动单个服务（本地构建或 Docker 运行）
 */
function startService(service: ServiceResolution, forceImage: boolean): ChildProcess | null {
  const localExists = fs.existsSync(service.localPath);

  if (!forceImage && localExists) {
    // 本地模式：install → build → start
    console.log(`\n📦 [${service.name}] 使用本地代码: ${service.localPath}`);

    execSync(service.installCmd, { cwd: service.localPath, stdio: 'inherit' });
    if (service.buildCmd) {
      execSync(service.buildCmd, { cwd: service.localPath, stdio: 'inherit' });
    }

    const env = {
      ...process.env,
      ...service.otelEnv,
      PORT: String(service.port),
      JWT_SECRET: 'e2e-local-secret-key-that-is-at-least-32-characters-long',
      DATABASE_URL: ':memory:',
      NODE_ENV: 'test',
      HARNESS_START_SERVER: 'true',
    };

    const child = spawn(service.startCmd.split(' ')[0], service.startCmd.split(' ').slice(1), {
      cwd: service.localPath,
      env,
      stdio: 'pipe',
      shell: true,
    });

    runningProcesses.push(child);
    console.log(`✅ [${service.name}] 本地服务已启动 (PID: ${child.pid})`);
    return child;
  } else {
    // Docker 镜像兜底模式
    console.log(`\n🐳 [${service.name}] 使用 Docker 镜像: ${service.imageName}`);

    // 检查 Docker 登录状态
    try {
      execSync('docker info', { stdio: 'pipe' });
    } catch {
      console.error('❌ Docker 未运行或未登录。请先执行:');
      console.error('   echo $GITHUB_TOKEN | docker login ghcr.io -u <username> --password-stdin');
      process.exit(1);
    }

    const envArgs = Object.entries(service.otelEnv).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
    if (service.name === 'backend') {
      envArgs.push('-e', 'JWT_SECRET=e2e-docker-secret');
      envArgs.push('-e', `PORT=3001`);
    }

    const dockerArgs = [
      'run', '-d', '--rm',
      ...service.dockerRunArgs,
      ...envArgs,
      service.imageName,
    ];

    const containerId = execSync(`docker ${dockerArgs.join(' ')}`, { encoding: 'utf8' }).trim();
    console.log(`✅ [${service.name}] Docker 容器已启动: ${containerId.slice(0, 12)}`);
    return null;
  }
}

// ─── 健康检查 ───────────────────────────────────────────────────────────────

/**
 * 轮询等待服务健康检查通过
 */
async function waitForHealth(url: string, timeoutMs = 60000): Promise<void> {
  const start = Date.now();
  const interval = 1000;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // 服务尚未就绪，继续等待
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`❌ 健康检查超时: ${url} (${timeoutMs}ms)`);
}

// ─── Playwright 执行 ────────────────────────────────────────────────────────

/**
 * 执行 Playwright E2E 测试，返回测试结果统计和原始 JSON 数据
 */
function runPlaywright(ports: PortsConfig): { passed: number; failed: number; skipped: number; rawJson: any } {
  console.log('\n🎭 执行 Playwright E2E 测试...');

  const env = {
    ...process.env,
    BASE_URL: `http://localhost:${ports.frontend}`,
    API_URL: `http://localhost:${ports.backend}`,
  };

  let rawJson: any = null;
  try {
    const output = execSync('npx playwright test --reporter=json', {
      cwd: ROOT_DIR,
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    try { rawJson = JSON.parse(output); } catch { /* 解析失败则保留 null */ }
    const stats = rawJson?.stats;
    return {
      passed: stats?.expected ?? 0,
      failed: stats?.unexpected ?? 0,
      skipped: stats?.skipped ?? 0,
      rawJson,
    };
  } catch (error: any) {
    // Playwright 测试失败时仍然继续（收集报告）
    console.warn('⚠️  部分测试失败，继续生成报告...');
    // 尝试从 stdout 解析 JSON
    const stdout = error.stdout?.toString() || '';
    try { rawJson = JSON.parse(stdout); } catch { /* 解析失败 */ }
    const stats = rawJson?.stats;
    return {
      passed: stats?.expected ?? 0,
      failed: stats?.unexpected ?? 0,
      skipped: stats?.skipped ?? 0,
      rawJson,
    };
  }
}

// ─── 可观测性查询 ───────────────────────────────────────────────────────────

/**
 * 查询可观测性栈 API，收集测试期间的日志、指标和追踪数据
 */
async function queryObservability(ports: PortsConfig): Promise<Partial<E2EReport>> {
  console.log('\n📊 查询可观测性数据...');

  const report: Partial<E2EReport> = {
    errorLogs: [],
    httpMetrics: { totalRequests: 0, errorRate: 0, p99Latency: 0 },
    failedTraces: [],
  };

  try {
    // 查询 VictoriaLogs 错误日志
    const logsUrl = `http://localhost:${ports.victoriaLogs}/select/logsql/query?query=level:error&limit=50`;
    const logsResp = await fetch(logsUrl);
    if (logsResp.ok) {
      const logsText = await logsResp.text();
      const lines = logsText.trim().split('\n').filter(Boolean);
      report.errorLogs = lines.map((line) => {
        try {
          const parsed = JSON.parse(line);
          return {
            timestamp: parsed._time || parsed.timestamp || '',
            message: parsed._msg || parsed.message || line,
            service: parsed.service || 'unknown',
            traceId: parsed.trace_id,
          };
        } catch {
          return { timestamp: '', message: line, service: 'unknown' };
        }
      });
    }
  } catch (e) {
    console.warn('⚠️  VictoriaLogs 查询失败（可能未启动）');
  }

  try {
    // 查询 VictoriaMetrics HTTP 指标
    const metricsUrl = `http://localhost:${ports.victoriaMetrics}/api/v1/query?query=http_requests_total`;
    const metricsResp = await fetch(metricsUrl);
    if (metricsResp.ok) {
      const metricsData = await metricsResp.json() as any;
      const results = metricsData?.data?.result || [];
      const total = results.reduce((sum: number, r: any) => sum + Number(r.value?.[1] || 0), 0);
      report.httpMetrics!.totalRequests = total;
    }
  } catch (e) {
    console.warn('⚠️  VictoriaMetrics 查询失败（可能未启动）');
  }

  return report;
}

// ─── 报告生成 ───────────────────────────────────────────────────────────────

/**
 * 测试用例元数据：描述每个用例的目的、输入参数和预期结果
 */
const TEST_CASE_META: Record<string, { purpose: string; inputs: string; expected: string }> = {
  '使用已注册账号成功登录后跳转到任务列表': {
    purpose: '验证已注册用户使用正确凭据登录后，系统能正确认证并跳转到任务列表页面',
    inputs: '邮箱: login_test_{timestamp}@example.com, 密码: password123（beforeAll 中通过 API 预注册）',
    expected: '1. 登录页面正常加载\n2. 填写表单后点击提交\n3. 页面跳转到 /tasks\n4. 任务列表页面可见',
  },
  '使用错误密码登录时页面显示错误提示': {
    purpose: '验证使用错误密码登录时，系统拒绝认证并在页面上显示错误提示信息',
    inputs: '邮箱: login_test_{timestamp}@example.com（已注册）, 密码: wrong_password_123（错误密码）',
    expected: '1. 登录页面正常加载\n2. 填写错误密码后点击提交\n3. 页面显示 login-error 错误提示\n4. 页面仍停留在 /login，未跳转',
  },
  '成功注册新用户后跳转到登录页': {
    purpose: '验证新用户填写注册表单提交后，系统成功创建账号并跳转到登录页面',
    inputs: '邮箱: test_{timestamp}@example.com（唯一）, 密码: password123',
    expected: '1. 注册页面正常加载\n2. 填写表单后点击提交\n3. 页面跳转到 /login\n4. 登录页面可见',
  },
  '登录后成功创建新任务并在列表中显示': {
    purpose: '验证已登录用户可以通过创建表单新建任务，任务创建后立即出现在任务列表中',
    inputs: '用户: create_task_{timestamp}@example.com（beforeAll 中预注册）, 任务标题: 测试任务_{timestamp}',
    expected: '1. 登录成功跳转到 /tasks\n2. 点击创建按钮后表单出现\n3. 输入标题按 Enter 提交\n4. 新任务出现在列表中',
  },
  '点击删除按钮后确认对话框出现，确认后任务消失': {
    purpose: '验证删除任务的完整流程：点击删除按钮弹出确认对话框，用户确认后任务从列表中移除',
    inputs: '用户: delete_task_{timestamp}@example.com（测试中注册）, 任务标题: 待删除任务_{timestamp}（测试中创建）',
    expected: '1. 注册并登录成功\n2. 创建任务后出现在列表中\n3. 点击删除按钮后确认对话框出现\n4. 点击确认后任务从列表消失',
  },
  '点击任务进入详情页并修改标题后保存': {
    purpose: '验证用户可以点击任务进入详情编辑页面，修改标题后保存成功',
    inputs: '用户: edit_task_{timestamp}@example.com（beforeAll 中预注册）, 原标题: 待编辑任务, 新标题: 已编辑任务_{timestamp}',
    expected: '1. 登录成功跳转到 /tasks\n2. 点击任务进入详情页\n3. 编辑表单可见\n4. 修改标题并保存\n5. 标题字段值更新为新标题',
  },
  '选择状态过滤器后列表内容相应变化': {
    purpose: '验证任务列表的状态过滤功能：选择不同状态后列表只显示对应状态的任务',
    inputs: '用户: filter_task_{timestamp}@example.com（beforeAll 中预注册）, 任务: 待处理任务A(pending) + 已完成任务B(done)',
    expected: '1. 登录后两个任务都可见\n2. 选择"已完成"过滤后只显示已完成任务B\n3. 选择"待处理"过滤后只显示待处理任务A',
  },
};

/**
 * 生成结构化 E2E 测试报告（控制台输出 + 文件写入）
 */
function generateReport(report: E2EReport, playwrightJson: any): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportsDir = path.join(ROOT_DIR, 'test-reports');

  // 确保 test-reports 目录存在
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // ─── 控制台输出 ───────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('📋 E2E 测试报告');
  console.log('═'.repeat(60));

  console.log('\n📊 测试结果:');
  console.log(`   ✅ 通过: ${report.testResults.passed}`);
  console.log(`   ❌ 失败: ${report.testResults.failed}`);
  console.log(`   ⏭️  跳过: ${report.testResults.skipped}`);

  if (report.errorLogs.length > 0) {
    console.log(`\n🔴 错误日志 (${report.errorLogs.length} 条):`);
    report.errorLogs.slice(0, 10).forEach((log) => {
      console.log(`   [${log.service}] ${log.message}`);
      if (log.traceId) {
        console.log(`     trace_id: ${log.traceId}`);
      }
    });
  } else {
    console.log('\n🟢 无错误日志');
  }

  console.log('\n📈 HTTP 指标:');
  console.log(`   总请求数: ${report.httpMetrics.totalRequests}`);
  console.log(`   错误率: ${(report.httpMetrics.errorRate * 100).toFixed(2)}%`);
  console.log(`   P99 延迟: ${report.httpMetrics.p99Latency}ms`);

  if (report.failedTraces.length > 0) {
    console.log(`\n🔗 失败用例追踪 (${report.failedTraces.length} 条):`);
    report.failedTraces.forEach((trace) => {
      console.log(`   ${trace.testName} → trace_id: ${trace.traceId} (${trace.spans} spans)`);
    });
  }

  console.log('\n' + '═'.repeat(60));

  // ─── 生成详细 Markdown 报告 ───────────────────────────────────────────
  const suites = playwrightJson?.suites || [];
  const totalDuration = ((playwrightJson?.stats?.duration || 0) / 1000).toFixed(1);
  const pwVersion = playwrightJson?.config?.version || 'unknown';

  let md = `# E2E 测试报告\n\n`;
  md += `| 属性 | 值 |\n|------|----|\n`;
  md += `| 执行时间 | ${new Date().toLocaleString('zh-CN')} |\n`;
  md += `| Playwright 版本 | v${pwVersion} |\n`;
  md += `| 总耗时 | ${totalDuration}s |\n`;
  md += `| 并发 Workers | ${playwrightJson?.config?.metadata?.actualWorkers || '-'} |\n`;
  md += `| 重试次数 | ${playwrightJson?.config?.projects?.[0]?.retries ?? '-'} |\n\n`;

  md += `## 测试结果总览\n\n`;
  const total = report.testResults.passed + report.testResults.failed + report.testResults.skipped;
  const passRate = total > 0 ? ((report.testResults.passed / total) * 100).toFixed(1) : '0.0';
  md += `| 指标 | 数值 |\n|------|------|\n`;
  md += `| ✅ 通过 | ${report.testResults.passed} |\n`;
  md += `| ❌ 失败 | ${report.testResults.failed} |\n`;
  md += `| ⏭️ 跳过 | ${report.testResults.skipped} |\n`;
  md += `| 总计 | ${total} |\n`;
  md += `| 通过率 | ${passRate}% |\n\n`;

  // ─── 逐用例详细报告 ───────────────────────────────────────────────────
  md += `## 用例详情\n\n`;

  let caseIndex = 0;
  for (const suite of suites) {
    const fileName = suite.file || suite.title || '';
    const innerSuites = suite.suites || [];
    for (const inner of innerSuites) {
      const suiteName = inner.title || '';
      const specs = inner.specs || [];
      for (const spec of specs) {
        caseIndex++;
        const testName = spec.title || '';
        const ok = spec.ok;
        const status = ok ? '✅ 通过' : '❌ 失败';
        const tests = spec.tests || [];

        // 收集执行结果
        let duration = 0;
        let retryCount = 0;
        let errorMessage = '';
        let allResults: Array<{ status: string; duration: number; retry: number }> = [];

        for (const t of tests) {
          const results = t.results || [];
          retryCount = results.length - 1;
          for (const r of results) {
            allResults.push({ status: r.status, duration: r.duration || 0, retry: r.retry || 0 });
            if (r.errors?.length && !errorMessage) {
              const rawErr = r.errors[0]?.message || '';
              errorMessage = rawErr.replace(/\u001b\[[0-9;]*m/g, '');
            }
          }
          const lastResult = results[results.length - 1];
          if (lastResult) {
            duration = lastResult.duration || 0;
          }
        }

        // 获取元数据
        const meta = TEST_CASE_META[testName] || {
          purpose: '（未定义）',
          inputs: '（未定义）',
          expected: '（未定义）',
        };

        md += `---\n\n`;
        md += `### ${caseIndex}. ${testName}\n\n`;
        md += `| 属性 | 值 |\n|------|----|\n`;
        md += `| 所属模块 | ${suiteName} |\n`;
        md += `| 测试文件 | \`${fileName}\` |\n`;
        md += `| 执行状态 | ${status} |\n`;
        md += `| 执行耗时 | ${duration}ms |\n`;
        md += `| 重试次数 | ${retryCount} |\n\n`;

        md += `**测试目的**\n\n${meta.purpose}\n\n`;
        md += `**输入参数**\n\n${meta.inputs}\n\n`;
        md += `**预期结果**\n\n${meta.expected}\n\n`;

        // 实际结果
        md += `**实际结果**\n\n`;
        if (ok) {
          md += `所有断言通过，用例执行成功。\n\n`;
        } else {
          md += `用例执行失败。\n\n`;
        }

        // 执行历史（含重试）
        if (allResults.length > 1) {
          md += `**执行历史**\n\n`;
          md += `| 次数 | 状态 | 耗时 |\n|------|------|------|\n`;
          for (const r of allResults) {
            const rStatus = r.status === 'passed' ? '✅ passed' : '❌ ' + r.status;
            md += `| 第${r.retry + 1}次 | ${rStatus} | ${r.duration}ms |\n`;
          }
          md += '\n';
        }

        // 错误信息
        if (errorMessage) {
          md += `**错误日志**\n\n`;
          md += `\`\`\`\n${errorMessage.slice(0, 1000)}\n\`\`\`\n\n`;
        }
      }
    }
  }

  // ─── 可观测性数据 ─────────────────────────────────────────────────────
  md += `---\n\n## 可观测性数据\n\n`;
  md += `### HTTP 指标\n\n`;
  md += `| 指标 | 数值 |\n|------|------|\n`;
  md += `| 总请求数 | ${report.httpMetrics.totalRequests} |\n`;
  md += `| 错误率 | ${(report.httpMetrics.errorRate * 100).toFixed(2)}% |\n`;
  md += `| P99 延迟 | ${report.httpMetrics.p99Latency}ms |\n\n`;

  if (report.errorLogs.length > 0) {
    md += `### 服务端错误日志 (${report.errorLogs.length} 条)\n\n`;
    md += `| 时间 | 服务 | 消息 | Trace ID |\n|------|------|------|----------|\n`;
    for (const log of report.errorLogs.slice(0, 30)) {
      const msg = log.message.replace(/\|/g, '\\|').slice(0, 100);
      md += `| ${log.timestamp} | ${log.service} | ${msg} | ${log.traceId || '-'} |\n`;
    }
    md += '\n';
  } else {
    md += `### 服务端错误日志\n\n无错误日志。\n\n`;
  }

  if (report.failedTraces.length > 0) {
    md += `### 失败用例关联追踪\n\n`;
    md += `| 用例 | Trace ID | Spans 数量 |\n|------|----------|------------|\n`;
    for (const trace of report.failedTraces) {
      md += `| ${trace.testName} | \`${trace.traceId}\` | ${trace.spans} |\n`;
    }
    md += '\n';
  }

  // 写入 Markdown 文件
  const mdFile = path.join(reportsDir, `e2e-report-${timestamp}.md`);
  fs.writeFileSync(mdFile, md, 'utf8');

  // 写入原始 JSON 数据
  const jsonFile = path.join(reportsDir, `e2e-report-${timestamp}.json`);
  const jsonReport = {
    timestamp: new Date().toISOString(),
    testResults: report.testResults,
    httpMetrics: report.httpMetrics,
    errorLogs: report.errorLogs,
    failedTraces: report.failedTraces,
    playwright: playwrightJson,
  };
  fs.writeFileSync(jsonFile, JSON.stringify(jsonReport, null, 2), 'utf8');

  console.log(`\n📄 详细报告已生成:`);
  console.log(`   ${mdFile}`);
  console.log(`   ${jsonFile}`);
}

// ─── 清理 ───────────────────────────────────────────────────────────────────

/**
 * 清理所有启动的进程和容器
 */
function cleanup(ports: PortsConfig, keepInfra: boolean): void {
  console.log('\n🧹 清理资源...');

  // 终止本地进程（Windows 需要杀掉整个进程树）
  for (const proc of runningProcesses) {
    if (proc.pid) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /T /F /PID ${proc.pid}`, { stdio: 'pipe' });
        } else {
          process.kill(-proc.pid, 'SIGTERM');
        }
        console.log(`   已终止进程 PID: ${proc.pid}`);
      } catch {
        // 进程可能已退出
      }
    }
  }

  // 停止 Docker 容器（通过 docker-compose down）
  if (!keepInfra) {
    const composeFile = path.join(ROOT_DIR, 'observability', 'docker-compose.yaml');
    if (fs.existsSync(composeFile)) {
      try {
        execSync(`docker-compose -f "${composeFile}" down`, { stdio: 'inherit' });
        console.log('   可观测性栈已停止');
      } catch {
        console.warn('   ⚠️  停止可观测性栈时出错');
      }
    }
  } else {
    console.log('   ℹ️  --keep-infra: 保留可观测性栈供手动排查');
  }

  console.log('✅ 清理完成');
}

// ─── 主流程 ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🚀 E2E 编排脚本启动\n');

  const args = parseArgs();
  let ports: PortsConfig | null = null;

  try {
    // 1. 分配动态端口
    ports = await allocatePorts();

    // 2. 启动可观测性栈
    if (!args.noObservability) {
      startObservability(ports);
    } else {
      console.log('\n⏭️  跳过可观测性栈（--no-observability）');
    }

    // 3. 解析并启动前端服务
    const feService = resolveService('frontend', ports, args.feImage);
    startService(feService, args.feImage);

    // 4. 解析并启动后端服务
    const beService = resolveService('backend', ports, args.beImage);
    startService(beService, args.beImage);

    // 5. 等待健康检查
    console.log('\n⏳ 等待服务就绪...');
    await waitForHealth(feService.healthCheckUrl);
    console.log(`   ✅ 前端就绪: ${feService.healthCheckUrl}`);
    await waitForHealth(beService.healthCheckUrl);
    console.log(`   ✅ 后端就绪: ${beService.healthCheckUrl}`);

    // 6. 执行 Playwright 测试
    const testResults = runPlaywright(ports);

    // 7. 查询可观测性数据
    let observabilityData: Partial<E2EReport> = {};
    if (!args.noObservability) {
      observabilityData = await queryObservability(ports);
    }

    // 8. 生成报告
    const report: E2EReport = {
      testResults,
      errorLogs: observabilityData.errorLogs || [],
      httpMetrics: observabilityData.httpMetrics || { totalRequests: 0, errorRate: 0, p99Latency: 0 },
      failedTraces: observabilityData.failedTraces || [],
    };
    generateReport(report, testResults.rawJson);

    // 根据测试结果设置退出码
    if (testResults.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    // 9. 清理
    if (ports) {
      cleanup(ports, args.keepInfra);
    }
    // 强制退出，避免残留子进程句柄阻止退出
    process.exit(process.exitCode ?? 0);
  }
}

// 执行主流程
main().catch((error) => {
  console.error('💥 E2E 编排脚本异常退出:', error.message);
  process.exit(1);
});
