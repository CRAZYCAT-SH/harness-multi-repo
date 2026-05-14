/**
 * Architecture Linter — 架构不变式校验工具
 *
 * 校验依赖方向、命名约定、文件大小、禁止模式等架构规则。
 * 入口命令：pnpm lint:arch
 *
 * 输出格式：文件路径、规则名称、修复指引、文档链接
 * 退出码：存在违规时以非零状态退出（exit 1），无违规时正常退出（exit 0）
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { LintEngine } from './engine.js';
import type { LintContext, LintViolation, SourceFile } from './types.js';
import { noReverseDependencyRule } from './rules/no-reverse-dependency.js';
import { noCrossDomainImportRule } from './rules/no-cross-domain-import.js';

/**
 * 递归扫描目录下所有 .ts 文件
 * @param dir - 要扫描的目录绝对路径
 * @param projectRoot - 项目根目录路径
 * @returns 源文件信息数组
 */
function scanDirectory(dir: string, projectRoot: string): SourceFile[] {
  const results: SourceFile[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // 跳过 node_modules 和隐藏目录
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }

    if (entry.isDirectory()) {
      results.push(...scanDirectory(fullPath, projectRoot));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');
      results.push({ path: fullPath, content, relativePath });
    }
  }

  return results;
}

/**
 * 收集项目中需要检查的所有源文件
 *
 * 扫描范围：backend/src、frontend/src、tools/*/src 下的 .ts 文件
 * @param projectRoot - 项目根目录路径
 * @returns 源文件信息数组
 */
function collectSourceFiles(projectRoot: string): SourceFile[] {
  const files: SourceFile[] = [];

  // 扫描 backend/src
  const backendSrc = path.join(projectRoot, 'backend', 'src');
  files.push(...scanDirectory(backendSrc, projectRoot));

  // 扫描 frontend/src
  const frontendSrc = path.join(projectRoot, 'frontend', 'src');
  files.push(...scanDirectory(frontendSrc, projectRoot));

  // 扫描 tools/*/src
  const toolsDir = path.join(projectRoot, 'tools');
  if (fs.existsSync(toolsDir)) {
    const toolEntries = fs.readdirSync(toolsDir, { withFileTypes: true });
    for (const toolEntry of toolEntries) {
      if (toolEntry.isDirectory() && !toolEntry.name.startsWith('.')) {
        const toolSrc = path.join(toolsDir, toolEntry.name, 'src');
        files.push(...scanDirectory(toolSrc, projectRoot));
      }
    }
  }

  return files;
}

/**
 * 格式化违规输出
 *
 * 输出格式包含：文件路径、规则名称、错误信息、修复指引、文档链接
 * @param violation - 违规报告对象
 * @returns 格式化后的字符串
 */
function formatViolation(violation: LintViolation): string {
  const lineInfo = violation.line != null ? `:${violation.line}` : '';
  return [
    `  文件: ${violation.filePath}${lineInfo}`,
    `  规则: ${violation.ruleName}`,
    `  问题: ${violation.message}`,
    `  修复: ${violation.fixHint}`,
    `  文档: ${violation.docLink}`,
  ].join('\n');
}

/**
 * Architecture Linter 主入口函数
 *
 * 1. 扫描项目源文件
 * 2. 构建 LintContext
 * 3. 注册所有规则
 * 4. 执行引擎
 * 5. 输出违规报告
 * 6. 根据是否存在违规设置退出码
 */
export async function main(): Promise<void> {
  // 确定项目根目录（向上查找包含 pnpm-workspace.yaml 的目录）
  const projectRoot = findProjectRoot(process.cwd());

  console.log('[arch-linter] 开始架构不变式校验...');
  console.log(`[arch-linter] 项目根目录: ${projectRoot}`);

  // 收集源文件
  const files = collectSourceFiles(projectRoot);
  console.log(`[arch-linter] 扫描到 ${files.length} 个 TypeScript 文件`);

  // 构建 Lint 上下文
  const context: LintContext = {
    files,
    projectRoot,
  };

  // 创建引擎并注册规则
  const engine = new LintEngine();

  // 依赖方向校验规则（Task 9.2）
  engine.registerRule(noReverseDependencyRule);
  engine.registerRule(noCrossDomainImportRule);

  // TODO: 在后续任务中注册具体规则（9.3 ~ 9.5）
  // engine.registerRule(fileNamingConventionRule);
  // engine.registerRule(maxFileLinesRule);
  // engine.registerRule(noConsoleInBusinessRule);
  // engine.registerRule(noAnyTypeRule);
  // engine.registerRule(noRawEnvAccessRule);
  // engine.registerRule(noRawRequestAccessRule);
  // engine.registerRule(agentsMdValidRule);
  // engine.registerRule(docFrontmatterValidRule);
  // engine.registerRule(dependencyDocumentedRule);

  // 执行所有规则
  const violations = engine.run(context);

  // 输出结果
  if (violations.length === 0) {
    console.log('[arch-linter] ✅ 未发现架构违规，所有规则通过');
    process.exit(0);
  } else {
    console.log(`[arch-linter] ❌ 发现 ${violations.length} 条架构违规:\n`);
    for (const violation of violations) {
      console.log(formatViolation(violation));
      console.log('');
    }
    process.exit(1);
  }
}

/**
 * 向上查找项目根目录
 *
 * 从当前目录开始向上查找，直到找到包含 pnpm-workspace.yaml 的目录。
 * 如果找不到则使用当前工作目录。
 * @param startDir - 起始查找目录
 * @returns 项目根目录路径
 */
function findProjectRoot(startDir: string): string {
  let current = startDir;

  while (true) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      // 已到达文件系统根目录，回退使用起始目录
      return startDir;
    }
    current = parent;
  }
}

// 执行主函数
main();
