/**
 * Self-Review 回路脚本
 *
 * 在 PR 推送前对当前分支执行自评审，依次运行：
 * typecheck → lint:arch → test → docs:garden → quality:score
 *
 * - 所有步骤通过时：生成 .agent/self-review.md（改动摘要模板）
 * - 任一步骤失败时：生成 .agent/self-review-failures.md（失败详情）
 *
 * @module self-review
 * @see Requirements 11.1, 11.2, 11.3, 11.4
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** 自评审执行步骤定义 */
interface ReviewStep {
  /** 步骤名称 */
  name: string;
  /** 执行的 shell 命令 */
  command: string;
}

/** 步骤失败记录 */
interface StepFailure {
  /** 失败的步骤名称 */
  step: string;
  /** 失败输出内容 */
  output: string;
}

/**
 * 自评审回路依次执行的步骤列表
 * 顺序：类型检查 → 架构 Linter → 测试 → 文档扫描 → 质量评分
 */
const STEPS: ReviewStep[] = [
  { name: 'typecheck', command: 'pnpm typecheck' },
  { name: 'lint:arch', command: 'pnpm lint:arch' },
  { name: 'test', command: 'pnpm test' },
  { name: 'docs:garden', command: 'pnpm docs:garden' },
  { name: 'quality:score', command: 'pnpm quality:score' },
];

/**
 * 自评审主函数
 *
 * 依次执行所有检查步骤，根据结果生成对应的报告文件：
 * - 全部通过：生成 .agent/self-review.md
 * - 存在失败：生成 .agent/self-review-failures.md 并以非零状态退出
 */
async function main(): Promise<void> {
  const outputDir = path.resolve(process.cwd(), '.agent');
  fs.mkdirSync(outputDir, { recursive: true });

  const failures: StepFailure[] = [];

  for (const step of STEPS) {
    try {
      execSync(step.command, { stdio: 'pipe', encoding: 'utf-8' });
      console.log(`✅ ${step.name} 通过`);
    } catch (err: unknown) {
      const error = err as { stdout?: string; message?: string };
      console.log(`❌ ${step.name} 失败`);
      failures.push({ step: step.name, output: error.stdout || error.message || '未知错误' });
    }
  }

  if (failures.length === 0) {
    // 所有步骤通过 — 生成成功报告
    const report = generateSuccessReport();
    fs.writeFileSync(path.join(outputDir, 'self-review.md'), report);
    console.log('自评审通过，报告已生成: .agent/self-review.md');
  } else {
    // 存在失败步骤 — 生成失败报告
    const report = generateFailureReport(failures);
    fs.writeFileSync(path.join(outputDir, 'self-review-failures.md'), report);
    console.log('自评审失败，报告已生成: .agent/self-review-failures.md');
    process.exit(1);
  }
}

/**
 * 生成自评审成功报告
 *
 * 包含：本次改动摘要模板、受影响的业务域、执行步骤清单
 *
 * @returns 成功报告的 Markdown 内容
 */
function generateSuccessReport(): string {
  const timestamp = new Date().toISOString();
  return `# Self-Review Report

## 结果

所有检查通过 ✅

## 生成时间

${timestamp}

## 执行步骤

${STEPS.map(s => `- [x] ${s.name}`).join('\n')}

## 改动摘要

<!-- 请填写本次改动的摘要 -->

### 受影响的业务域

- [ ] auth
- [ ] task
- [ ] 工具链
- [ ] 文档

### 新增/修改/删除的公开 API

<!-- 列出变更的 API 端点或公开接口 -->

### 遗留 TODO

<!-- 列出本次未完成但需后续处理的事项 -->

### QUALITY_SCORE 变化

<!-- 记录质量评分的变化（如有） -->
`;
}

/**
 * 生成自评审失败报告
 *
 * 包含：失败步骤名称、失败输出、相关文档链接
 *
 * @param failures - 失败步骤记录数组
 * @returns 失败报告的 Markdown 内容
 */
function generateFailureReport(failures: StepFailure[]): string {
  const timestamp = new Date().toISOString();
  const failureDetails = failures.map(f => `### ${f.step}

\`\`\`
${f.output}
\`\`\`

**相关文档**: ${getDocLink(f.step)}
`).join('\n');

  return `# Self-Review Failures

## 生成时间

${timestamp}

## 失败步骤

${failureDetails}

## 建议操作

1. 逐一修复上述失败步骤
2. 重新运行 \`pnpm agent:self-review\` 确认全部通过
3. 参考相关文档链接获取修复指引
`;
}

/**
 * 根据步骤名称返回相关文档链接
 *
 * @param stepName - 步骤名称
 * @returns 对应的文档相对路径
 */
function getDocLink(stepName: string): string {
  const docLinks: Record<string, string> = {
    'typecheck': 'docs/design-docs/tech-stack.md',
    'lint:arch': 'docs/design-docs/golden-principles.md',
    'test': 'docs/generated/coverage-report.md',
    'docs:garden': 'docs/generated/doc-gardener-report.md',
    'quality:score': 'docs/QUALITY_SCORE.md',
  };
  return docLinks[stepName] ?? 'docs/design-docs/index.md';
}

main();
