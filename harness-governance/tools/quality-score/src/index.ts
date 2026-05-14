/**
 * Quality Score — 质量评分生成器
 *
 * 按业务域输出 test_coverage、type_strictness、doc_freshness、architecture_compliance 评分。
 * 入口命令：pnpm quality:score
 *
 * 评分维度：
 * - test_coverage: 测试文件与源文件的比率
 * - type_strictness: tsconfig strict 模式 + 无 `any` 使用
 * - doc_freshness: 文档 last_verified 日期的新鲜度
 * - architecture_compliance: 架构合规性（无违规模式）
 *
 * @validates Requirements 9.3, 9.4, 9.5
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================
// 类型定义
// ============================================================

/**
 * 单个业务域的质量评分
 */
interface DomainScore {
  /** 域名称 */
  domain: string;
  /** 测试覆盖率评分 (0-100) */
  test_coverage: number;
  /** 类型严格度评分 (0-100) */
  type_strictness: number;
  /** 文档新鲜度评分 (0-100) */
  doc_freshness: number;
  /** 架构合规性评分 (0-100) */
  architecture_compliance: number;
}

/**
 * 完整的质量报告
 */
interface QualityReport {
  /** 报告生成时间 (ISO 8601) */
  last_generated: string;
  /** 各域评分 */
  domains: DomainScore[];
  /** 总体评分 */
  overall: DomainScore;
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 查找项目根目录（包含 package.json 且 name 为 harness-demo-fullstack 的目录）
 */
function findProjectRoot(): string {
  let dir = path.resolve(__dirname, '..', '..', '..');
  // 回退查找，最多向上 5 层
  for (let i = 0; i < 5; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === 'harness-demo-fullstack') {
          return dir;
        }
      } catch {
        // 忽略解析错误，继续向上查找
      }
    }
    dir = path.dirname(dir);
  }
  // 如果找不到，使用 __dirname 的上三级目录作为默认值
  return path.resolve(__dirname, '..', '..', '..');
}

/**
 * 递归收集目录下所有 TypeScript 源文件路径
 * @param dir - 目标目录
 * @param extensions - 文件扩展名列表
 * @returns 文件路径数组
 */
function collectFiles(dir: string, extensions: string[] = ['.ts', '.tsx']): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // 跳过 node_modules、dist、__tests__ 等目录
      if (['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) continue;
      results.push(...collectFiles(fullPath, extensions));
    } else if (entry.isFile()) {
      if (extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/**
 * 判断文件是否为测试文件
 * @param filePath - 文件路径
 */
function isTestFile(filePath: string): boolean {
  const name = path.basename(filePath);
  return (
    name.includes('.test.') ||
    name.includes('.spec.') ||
    name.includes('.property.test.') ||
    filePath.includes('__tests__')
  );
}

/**
 * 判断文件是否为源文件（非测试文件）
 * @param filePath - 文件路径
 */
function isSourceFile(filePath: string): boolean {
  return !isTestFile(filePath);
}

// ============================================================
// 评分计算函数
// ============================================================

/**
 * 计算测试覆盖率评分
 * 简化实现：测试文件数 / 源文件数 的比率，映射到 0-100
 * @param domainDir - 域目录路径
 */
function calculateTestCoverage(domainDir: string): number {
  const allFiles = collectFiles(domainDir);
  const sourceFiles = allFiles.filter(isSourceFile);
  const testFiles = allFiles.filter(isTestFile);

  if (sourceFiles.length === 0) return 0;

  // 比率：每个源文件对应一个测试文件为 100 分
  const ratio = testFiles.length / sourceFiles.length;
  // 上限为 100，比率 >= 1 即满分
  return Math.min(Math.round(ratio * 100), 100);
}

/**
 * 计算类型严格度评分
 * 检查项：
 * 1. tsconfig 是否启用 strict 模式 (50分)
 * 2. 源文件中 `any` 使用频率 (50分)
 * @param domainDir - 域目录路径
 * @param projectRoot - 项目根目录
 */
function calculateTypeStrictness(domainDir: string, projectRoot: string): number {
  let score = 0;

  // 检查 tsconfig strict 模式
  const tsconfigPath = path.join(projectRoot, 'tsconfig.base.json');
  if (fs.existsSync(tsconfigPath)) {
    try {
      const content = fs.readFileSync(tsconfigPath, 'utf-8');
      // 简单检查 "strict": true
      if (content.includes('"strict": true') || content.includes('"strict":true')) {
        score += 50;
      }
    } catch {
      // 忽略读取错误
    }
  }

  // 检查 `any` 使用频率
  const sourceFiles = collectFiles(domainDir).filter(isSourceFile);
  if (sourceFiles.length === 0) return score;

  let totalLines = 0;
  let anyCount = 0;
  const anyPattern = /\bany\b/g;

  for (const file of sourceFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      totalLines += lines.length;
      // 统计 `any` 出现次数（排除注释中的）
      for (const line of lines) {
        const trimmed = line.trim();
        // 跳过注释行
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
        const matches = trimmed.match(anyPattern);
        if (matches) {
          anyCount += matches.length;
        }
      }
    } catch {
      // 忽略读取错误
    }
  }

  // any 使用率：每 100 行出现 1 次 any 扣 10 分（从 50 分中扣）
  if (totalLines > 0) {
    const anyRate = (anyCount / totalLines) * 100;
    const deduction = Math.min(anyRate * 10, 50);
    score += Math.max(50 - Math.round(deduction), 0);
  } else {
    score += 50; // 无代码则满分
  }

  return score;
}

/**
 * 计算文档新鲜度评分
 * 扫描 docs/ 目录下的 markdown 文件，检查 last_verified 日期
 * @param projectRoot - 项目根目录
 */
function calculateDocFreshness(projectRoot: string): number {
  const docsDir = path.join(projectRoot, 'docs');
  const mdFiles = collectFiles(docsDir, ['.md']);

  if (mdFiles.length === 0) return 0;

  const now = new Date();
  let totalDocs = 0;
  let freshDocs = 0;
  const freshnessThreshold = 90; // 90 天内视为新鲜

  for (const file of mdFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      // 解析 YAML frontmatter 中的 last_verified 字段
      const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const lastVerifiedMatch = frontmatter.match(/last_verified:\s*["']?(\d{4}-\d{2}-\d{2})["']?/);
        if (lastVerifiedMatch) {
          totalDocs++;
          const verifiedDate = new Date(lastVerifiedMatch[1] as string);
          const daysDiff = Math.floor((now.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff <= freshnessThreshold) {
            freshDocs++;
          }
        }
      }
    } catch {
      // 忽略读取错误
    }
  }

  if (totalDocs === 0) {
    // 没有带 frontmatter 的文档，给一个基础分
    return 50;
  }

  return Math.round((freshDocs / totalDocs) * 100);
}

/**
 * 计算架构合规性评分
 * 简化实现：检查以下违规模式
 * 1. 禁止 console.* 在业务代码中 (25分)
 * 2. 禁止直接 process.env (25分)
 * 3. 禁止 req.body/req.query/req.params 在 service 层 (25分)
 * 4. 文件行数不超过 500 行 (25分)
 * @param domainDir - 域目录路径
 */
function calculateArchitectureCompliance(domainDir: string): number {
  const sourceFiles = collectFiles(domainDir).filter(isSourceFile);
  if (sourceFiles.length === 0) return 100;

  let consoleViolations = 0;
  let envViolations = 0;
  let rawRequestViolations = 0;
  let fileSizeViolations = 0;

  for (const file of sourceFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      // 跳过 providers/logger 中的 console 使用
      const isLoggerFile = file.includes('logger');

      // 检查 console.* 使用
      if (!isLoggerFile) {
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
          if (/\bconsole\.(log|error|warn|info|debug)\b/.test(trimmed)) {
            consoleViolations++;
          }
        }
      }

      // 检查直接 process.env 使用（排除 boundary/ 目录）
      const isBoundaryFile = file.includes('boundary');
      if (!isBoundaryFile) {
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
          if (/\bprocess\.env\b/.test(trimmed)) {
            envViolations++;
          }
        }
      }

      // 检查 service 层中的 req.body/req.query/req.params
      const isServiceFile = file.includes('service');
      if (isServiceFile) {
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
          if (/\breq\.(body|query|params)\b/.test(trimmed)) {
            rawRequestViolations++;
          }
        }
      }

      // 检查文件行数（有效行数：排除空行和注释行）
      let effectiveLines = 0;
      let inBlockComment = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (inBlockComment) {
          if (trimmed.includes('*/')) {
            inBlockComment = false;
          }
          continue;
        }
        if (trimmed.startsWith('/*')) {
          inBlockComment = true;
          if (trimmed.includes('*/')) {
            inBlockComment = false;
          }
          continue;
        }
        if (trimmed === '' || trimmed.startsWith('//')) continue;
        effectiveLines++;
      }
      if (effectiveLines > 500) {
        fileSizeViolations++;
      }
    } catch {
      // 忽略读取错误
    }
  }

  // 每个维度 25 分，有违规则按比例扣分
  let score = 0;

  // console 违规：0 次满分，每次扣 5 分
  score += Math.max(25 - consoleViolations * 5, 0);
  // env 违规：0 次满分，每次扣 10 分
  score += Math.max(25 - envViolations * 10, 0);
  // raw request 违规：0 次满分，每次扣 10 分
  score += Math.max(25 - rawRequestViolations * 10, 0);
  // 文件大小违规：0 次满分，每个文件扣 10 分
  score += Math.max(25 - fileSizeViolations * 10, 0);

  return Math.min(score, 100);
}

// ============================================================
// 报告生成
// ============================================================

/**
 * 生成 Markdown 格式的质量评分报告
 * @param report - 质量报告数据
 */
function generateMarkdown(report: QualityReport): string {
  const lines: string[] = [
    '# 质量评分报告',
    '',
    `> **last_generated**: ${report.last_generated}`,
    '',
    '本报告由 `pnpm quality:score` 自动生成，按业务域输出代码库健康度评分。',
    '',
    '## 评分总览',
    '',
    '| 域名 | test_coverage | type_strictness | doc_freshness | architecture_compliance |',
    '|------|---------------|-----------------|---------------|-------------------------|',
  ];

  // 各域评分行
  for (const domain of report.domains) {
    lines.push(
      `| ${domain.domain} | ${domain.test_coverage} | ${domain.type_strictness} | ${domain.doc_freshness} | ${domain.architecture_compliance} |`
    );
  }

  // 总体评分行
  lines.push(
    `| **overall** | **${report.overall.test_coverage}** | **${report.overall.type_strictness}** | **${report.overall.doc_freshness}** | **${report.overall.architecture_compliance}** |`
  );

  lines.push(
    '',
    '## 评分说明',
    '',
    '- **test_coverage**：测试文件与源文件的比率（0–100）',
    '- **type_strictness**：TypeScript 严格模式合规度，含 `any` 使用检查（0–100）',
    '- **doc_freshness**：文档新鲜度，基于 `last_verified` 日期是否在 90 天内（0–100）',
    '- **architecture_compliance**：架构不变式合规度，检查禁止模式违规（0–100）',
    '',
  );

  return lines.join('\n');
}

/**
 * 计算总体评分（各域评分的平均值）
 * @param domains - 各域评分数组
 */
function calculateOverall(domains: DomainScore[]): DomainScore {
  if (domains.length === 0) {
    return {
      domain: 'overall',
      test_coverage: 0,
      type_strictness: 0,
      doc_freshness: 0,
      architecture_compliance: 0,
    };
  }

  const sum = domains.reduce(
    (acc, d) => ({
      test_coverage: acc.test_coverage + d.test_coverage,
      type_strictness: acc.type_strictness + d.type_strictness,
      doc_freshness: acc.doc_freshness + d.doc_freshness,
      architecture_compliance: acc.architecture_compliance + d.architecture_compliance,
    }),
    { test_coverage: 0, type_strictness: 0, doc_freshness: 0, architecture_compliance: 0 }
  );

  const count = domains.length;
  return {
    domain: 'overall',
    test_coverage: Math.round(sum.test_coverage / count),
    type_strictness: Math.round(sum.type_strictness / count),
    doc_freshness: Math.round(sum.doc_freshness / count),
    architecture_compliance: Math.round(sum.architecture_compliance / count),
  };
}

// ============================================================
// 主入口
// ============================================================

/**
 * 质量评分生成器主函数
 *
 * 执行流程：
 * 1. 定位项目根目录
 * 2. 遍历各业务域，计算四维评分
 * 3. 计算总体评分
 * 4. 生成 Markdown 报告
 * 5. 写入 docs/QUALITY_SCORE.md
 */
export async function main(): Promise<void> {
  const projectRoot = findProjectRoot();
  const domainsDir = path.join(projectRoot, 'backend', 'src', 'domains');

  // 定义需要评分的业务域
  const domainNames = ['auth', 'task'];
  const domainScores: DomainScore[] = [];

  // 文档新鲜度是全局维度，所有域共享同一评分
  const docFreshnessScore = calculateDocFreshness(projectRoot);

  for (const domainName of domainNames) {
    const domainDir = path.join(domainsDir, domainName);

    if (!fs.existsSync(domainDir)) {
      // 域目录不存在，给 0 分
      domainScores.push({
        domain: domainName,
        test_coverage: 0,
        type_strictness: 0,
        doc_freshness: docFreshnessScore,
        architecture_compliance: 0,
      });
      continue;
    }

    const testCoverage = calculateTestCoverage(domainDir);
    const typeStrictness = calculateTypeStrictness(domainDir, projectRoot);
    const architectureCompliance = calculateArchitectureCompliance(domainDir);

    domainScores.push({
      domain: domainName,
      test_coverage: testCoverage,
      type_strictness: typeStrictness,
      doc_freshness: docFreshnessScore,
      architecture_compliance: architectureCompliance,
    });
  }

  // 计算总体评分
  const overall = calculateOverall(domainScores);

  // 构建报告
  const report: QualityReport = {
    last_generated: new Date().toISOString(),
    domains: domainScores,
    overall,
  };

  // 生成 Markdown
  const markdown = generateMarkdown(report);

  // 写入文件
  const outputPath = path.join(projectRoot, 'docs', 'QUALITY_SCORE.md');
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, markdown, 'utf-8');

  // 输出结果摘要
  console.log('[quality-score] 质量评分报告已生成');
  console.log(`[quality-score] 输出路径: ${outputPath}`);
  console.log('[quality-score] 评分摘要:');
  for (const domain of domainScores) {
    console.log(
      `  ${domain.domain}: coverage=${domain.test_coverage}, strictness=${domain.type_strictness}, freshness=${domain.doc_freshness}, compliance=${domain.architecture_compliance}`
    );
  }
  console.log(
    `  overall: coverage=${overall.test_coverage}, strictness=${overall.type_strictness}, freshness=${overall.doc_freshness}, compliance=${overall.architecture_compliance}`
  );
}

// 直接执行
main().catch((err: unknown) => {
  console.error('[quality-score] 执行失败:', err);
  process.exit(1);
});
