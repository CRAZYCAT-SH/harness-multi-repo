/**
 * Doc Gardener — 文档新鲜度扫描器
 *
 * 扫描过时文档、失效链接、孤立文档，输出修复建议报告。
 * 入口命令：pnpm docs:garden
 *
 * 功能：
 * 1. 扫描过期文档（last_verified 距今超过 90 天）
 * 2. 检测 markdown 文件中的失效相对路径链接
 * 3. 检测孤立文档（未被任何 index.md 引用）
 * 4. 检测 exec-plans/active/ 中所有 checkbox 已完成的执行计划（建议移至 completed/）
 * 5. 输出报告到 docs/generated/doc-gardener-report.md
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================
// 类型定义
// ============================================================

/** 过期文档信息 */
interface ExpiredDoc {
  /** 文档相对路径 */
  path: string;
  /** 最后验证日期 */
  lastVerified: string;
  /** 距今天数 */
  daysSinceVerification: number;
}

/** 失效链接信息 */
interface BrokenLink {
  /** 源文件相对路径 */
  sourcePath: string;
  /** 目标路径（链接中的原始值） */
  targetPath: string;
  /** 所在行号 */
  line: number;
}

/** 待移动文件信息 */
interface PendingMove {
  /** 源路径 */
  from: string;
  /** 目标路径 */
  to: string;
  /** 移动原因 */
  reason: string;
}

/** 文档园丁报告 */
interface GardenReport {
  /** 报告生成时间（ISO 8601） */
  generatedAt: string;
  /** 过期文档列表 */
  expiredDocs: ExpiredDoc[];
  /** 失效链接列表 */
  brokenLinks: BrokenLink[];
  /** 孤立文档列表（相对路径） */
  orphanedDocs: string[];
  /** 待移动文件列表 */
  pendingMoves: PendingMove[];
}

// ============================================================
// 工具函数
// ============================================================

/** 过期阈值（天） */
const EXPIRY_THRESHOLD_DAYS = 90;

/**
 * 查找项目根目录
 * 从当前工作目录向上查找包含 package.json 且 name 为 harness-demo-fullstack 的目录
 */
function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
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
  // 回退到当前工作目录
  return process.cwd();
}

/**
 * 递归扫描目录下所有 .md 文件
 * @param dirPath - 目录绝对路径
 * @param projectRoot - 项目根目录
 * @returns 相对于项目根目录的 .md 文件路径列表
 */
function scanMarkdownFiles(dirPath: string, projectRoot: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dirPath)) {
    return results;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      // 跳过 node_modules 和隐藏目录
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      results.push(...scanMarkdownFiles(fullPath, projectRoot));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(path.relative(projectRoot, fullPath));
    }
  }

  return results;
}

/**
 * 解析 YAML frontmatter 中的 last_verified 字段
 * @param content - 文件内容
 * @returns last_verified 日期字符串，若不存在则返回 null
 */
function parseFrontmatterLastVerified(content: string): string | null {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const frontmatter = frontmatterMatch[1];
  if (!frontmatter) {
    return null;
  }

  // 匹配 last_verified 字段（支持带引号和不带引号的值）
  const lastVerifiedMatch = frontmatter.match(/^last_verified:\s*["']?(\d{4}-\d{2}-\d{2})["']?/m);
  if (!lastVerifiedMatch || !lastVerifiedMatch[1]) {
    return null;
  }

  return lastVerifiedMatch[1];
}

/**
 * 解析 YAML frontmatter 中的 status 字段
 * @param content - 文件内容
 * @returns status 值，若不存在则返回 null
 */
function parseFrontmatterStatus(content: string): string | null {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const frontmatter = frontmatterMatch[1];
  if (!frontmatter) {
    return null;
  }

  const statusMatch = frontmatter.match(/^status:\s*["']?(\w+)["']?/m);
  if (!statusMatch || !statusMatch[1]) {
    return null;
  }

  return statusMatch[1];
}

/**
 * 计算两个日期之间的天数差
 * @param dateStr - ISO 日期字符串（YYYY-MM-DD）
 * @param now - 当前日期
 * @returns 天数差
 */
function daysBetween(dateStr: string, now: Date): number {
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 提取 markdown 文件中的所有相对路径链接
 * @param content - 文件内容
 * @returns 链接信息数组（目标路径和行号）
 */
function extractRelativeLinks(content: string): Array<{ target: string; line: number }> {
  const links: Array<{ target: string; line: number }> = [];
  const lines = content.split('\n');

  // 匹配 markdown 链接 [text](path) 中的相对路径
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;

  for (let i = 0; i < lines.length; i++) {
    const lineContent = lines[i];
    if (!lineContent) continue;

    let match: RegExpExecArray | null;
    linkRegex.lastIndex = 0;

    while ((match = linkRegex.exec(lineContent)) !== null) {
      const target = match[2];
      if (!target) continue;

      // 跳过外部链接（http/https）、锚点链接、邮件链接
      if (
        target.startsWith('http://') ||
        target.startsWith('https://') ||
        target.startsWith('#') ||
        target.startsWith('mailto:')
      ) {
        continue;
      }

      // 去除锚点部分
      const cleanTarget = target.split('#')[0];
      if (cleanTarget) {
        links.push({ target: cleanTarget, line: i + 1 });
      }
    }
  }

  return links;
}

/**
 * 从 index.md 文件中提取引用的文档路径
 * @param content - index.md 文件内容
 * @param indexDir - index.md 所在目录的绝对路径
 * @param projectRoot - 项目根目录
 * @returns 被引用的文档相对路径集合
 */
function extractReferencedDocs(
  content: string,
  indexDir: string,
  projectRoot: string
): Set<string> {
  const referenced = new Set<string>();
  const links = extractRelativeLinks(content);

  for (const link of links) {
    const absoluteTarget = path.resolve(indexDir, link.target);
    const relativePath = path.relative(projectRoot, absoluteTarget);
    // 统一使用正斜杠
    referenced.add(relativePath.replace(/\\/g, '/'));
  }

  return referenced;
}

/**
 * 检测执行计划文件中的 checkbox 是否全部完成
 * @param content - 文件内容
 * @returns true 表示所有 checkbox 都已勾选
 */
function allCheckboxesCompleted(content: string): boolean {
  const lines = content.split('\n');
  let hasCheckbox = false;
  let hasUnchecked = false;

  for (const line of lines) {
    // 匹配已勾选的 checkbox：- [x] 或 - [X]
    if (/^\s*-\s*\[x\]/i.test(line)) {
      hasCheckbox = true;
    }
    // 匹配未勾选的 checkbox：- [ ]
    if (/^\s*-\s*\[\s\]/.test(line)) {
      hasCheckbox = true;
      hasUnchecked = true;
    }
  }

  // 必须至少有一个 checkbox，且全部已勾选
  return hasCheckbox && !hasUnchecked;
}

// ============================================================
// 核心扫描逻辑
// ============================================================

/**
 * 扫描过期文档
 * 检测 last_verified 距今超过 90 天且 status 为 validated 的文档
 */
function scanExpiredDocs(
  mdFiles: string[],
  projectRoot: string,
  now: Date
): ExpiredDoc[] {
  const expired: ExpiredDoc[] = [];

  for (const relPath of mdFiles) {
    const fullPath = path.join(projectRoot, relPath);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    const status = parseFrontmatterStatus(content);
    const lastVerified = parseFrontmatterLastVerified(content);

    // 仅检查 status 为 validated 且有 last_verified 的文档
    if (status !== 'validated' || !lastVerified) {
      continue;
    }

    const days = daysBetween(lastVerified, now);
    if (days > EXPIRY_THRESHOLD_DAYS) {
      expired.push({
        path: relPath.replace(/\\/g, '/'),
        lastVerified,
        daysSinceVerification: days,
      });
    }
  }

  // 按过期天数降序排列
  expired.sort((a, b) => b.daysSinceVerification - a.daysSinceVerification);
  return expired;
}

/**
 * 扫描失效链接
 * 检测 markdown 文件中指向不存在文件的相对路径链接
 */
function scanBrokenLinks(
  mdFiles: string[],
  projectRoot: string
): BrokenLink[] {
  const broken: BrokenLink[] = [];

  for (const relPath of mdFiles) {
    const fullPath = path.join(projectRoot, relPath);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    const fileDir = path.dirname(fullPath);
    const links = extractRelativeLinks(content);

    for (const link of links) {
      const absoluteTarget = path.resolve(fileDir, link.target);
      if (!fs.existsSync(absoluteTarget)) {
        broken.push({
          sourcePath: relPath.replace(/\\/g, '/'),
          targetPath: link.target,
          line: link.line,
        });
      }
    }
  }

  return broken;
}

/**
 * 扫描孤立文档
 * 检测 docs/ 下未被任何 index.md 引用的文档
 */
function scanOrphanedDocs(
  mdFiles: string[],
  projectRoot: string
): string[] {
  // 收集所有 index.md 文件引用的文档
  const allReferenced = new Set<string>();

  // 找到所有 index.md 文件
  const indexFiles = mdFiles.filter((f) => f.endsWith('index.md'));

  for (const indexFile of indexFiles) {
    const fullPath = path.join(projectRoot, indexFile);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    const indexDir = path.dirname(fullPath);
    const referenced = extractReferencedDocs(content, indexDir, projectRoot);
    for (const ref of referenced) {
      allReferenced.add(ref);
    }
  }

  // 筛选 docs/ 下的文档（排除 index.md 本身、generated/ 下的文件、.gitkeep）
  const orphaned: string[] = [];
  for (const relPath of mdFiles) {
    const normalizedPath = relPath.replace(/\\/g, '/');

    // 仅检查 docs/ 目录下的文件
    if (!normalizedPath.startsWith('docs/')) {
      continue;
    }

    // 排除 index.md 本身
    if (normalizedPath.endsWith('index.md')) {
      continue;
    }

    // 排除 generated/ 目录（自动生成的文件）
    if (normalizedPath.startsWith('docs/generated/')) {
      continue;
    }

    // 排除 QUALITY_SCORE.md（根级别特殊文件）
    if (normalizedPath === 'docs/QUALITY_SCORE.md') {
      continue;
    }

    // 检查是否被任何 index.md 引用
    if (!allReferenced.has(normalizedPath)) {
      orphaned.push(normalizedPath);
    }
  }

  orphaned.sort();
  return orphaned;
}

/**
 * 扫描待归档的执行计划
 * 检测 exec-plans/active/ 中所有 checkbox 已完成的文件
 */
function scanPendingMoves(projectRoot: string): PendingMove[] {
  const pending: PendingMove[] = [];
  const activeDir = path.join(projectRoot, 'docs', 'exec-plans', 'active');

  if (!fs.existsSync(activeDir)) {
    return pending;
  }

  const entries = fs.readdirSync(activeDir, { withFileTypes: true });
  for (const entry of entries) {
    // 仅检查 .md 文件
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    const fullPath = path.join(activeDir, entry.name);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    if (allCheckboxesCompleted(content)) {
      const fromPath = `docs/exec-plans/active/${entry.name}`;
      const toPath = `docs/exec-plans/completed/${entry.name}`;
      pending.push({
        from: fromPath,
        to: toPath,
        reason: '所有步骤已完成，建议归档到 completed/ 目录',
      });
    }
  }

  return pending;
}

// ============================================================
// 报告生成
// ============================================================

/**
 * 生成 markdown 格式的报告
 */
function generateReportMarkdown(report: GardenReport): string {
  const lines: string[] = [];

  lines.push('# 文档园丁报告');
  lines.push('');
  lines.push('> ⚠️ **此文件由 `pnpm docs:garden` 自动生成，请勿手动编辑。**');
  lines.push('');
  lines.push(`**生成时间**：${report.generatedAt}`);
  lines.push('');

  // 摘要
  lines.push('## 摘要');
  lines.push('');
  lines.push(`| 类别 | 数量 |`);
  lines.push(`|------|------|`);
  lines.push(`| 过期文档 | ${report.expiredDocs.length} |`);
  lines.push(`| 失效链接 | ${report.brokenLinks.length} |`);
  lines.push(`| 孤立文档 | ${report.orphanedDocs.length} |`);
  lines.push(`| 待归档计划 | ${report.pendingMoves.length} |`);
  lines.push('');

  // 过期文档
  lines.push('## 过期文档');
  lines.push('');
  if (report.expiredDocs.length === 0) {
    lines.push('✅ 无过期文档。');
  } else {
    lines.push('以下文档的 `last_verified` 距今超过 90 天，建议重新验证：');
    lines.push('');
    lines.push('| 文件路径 | 最后验证日期 | 过期天数 |');
    lines.push('|----------|-------------|----------|');
    for (const doc of report.expiredDocs) {
      lines.push(`| \`${doc.path}\` | ${doc.lastVerified} | ${doc.daysSinceVerification} |`);
    }
  }
  lines.push('');

  // 失效链接
  lines.push('## 失效链接');
  lines.push('');
  if (report.brokenLinks.length === 0) {
    lines.push('✅ 无失效链接。');
  } else {
    lines.push('以下链接指向不存在的文件，请修复或移除：');
    lines.push('');
    lines.push('| 源文件 | 目标路径 | 行号 |');
    lines.push('|--------|----------|------|');
    for (const link of report.brokenLinks) {
      lines.push(`| \`${link.sourcePath}\` | \`${link.targetPath}\` | ${link.line} |`);
    }
  }
  lines.push('');

  // 孤立文档
  lines.push('## 孤立文档');
  lines.push('');
  if (report.orphanedDocs.length === 0) {
    lines.push('✅ 无孤立文档。');
  } else {
    lines.push('以下文档未被任何 `index.md` 引用，可能需要添加索引或清理：');
    lines.push('');
    for (const doc of report.orphanedDocs) {
      lines.push(`- \`${doc}\``);
    }
  }
  lines.push('');

  // 待归档计划
  lines.push('## 待归档执行计划');
  lines.push('');
  if (report.pendingMoves.length === 0) {
    lines.push('✅ 无待归档的执行计划。');
  } else {
    lines.push('以下执行计划的所有步骤已完成，建议移动到 `completed/` 目录：');
    lines.push('');
    lines.push('| 当前路径 | 建议移至 | 原因 |');
    lines.push('|----------|----------|------|');
    for (const move of report.pendingMoves) {
      lines.push(`| \`${move.from}\` | \`${move.to}\` | ${move.reason} |`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ============================================================
// 主入口
// ============================================================

/**
 * Doc Gardener 主函数
 * 执行所有扫描并生成报告
 */
export async function main(): Promise<void> {
  const projectRoot = findProjectRoot();
  const docsDir = path.join(projectRoot, 'docs');
  const now = new Date();

  console.log('[doc-gardener] 开始扫描文档...');
  console.log(`[doc-gardener] 项目根目录: ${projectRoot}`);

  // 扫描 docs/ 目录下所有 markdown 文件
  const mdFiles = scanMarkdownFiles(docsDir, projectRoot);
  console.log(`[doc-gardener] 发现 ${mdFiles.length} 个 markdown 文件`);

  // 1. 扫描过期文档
  const expiredDocs = scanExpiredDocs(mdFiles, projectRoot, now);
  console.log(`[doc-gardener] 过期文档: ${expiredDocs.length} 个`);

  // 2. 检测失效链接
  const brokenLinks = scanBrokenLinks(mdFiles, projectRoot);
  console.log(`[doc-gardener] 失效链接: ${brokenLinks.length} 个`);

  // 3. 检测孤立文档
  const orphanedDocs = scanOrphanedDocs(mdFiles, projectRoot);
  console.log(`[doc-gardener] 孤立文档: ${orphanedDocs.length} 个`);

  // 4. 检测待归档执行计划
  const pendingMoves = scanPendingMoves(projectRoot);
  console.log(`[doc-gardener] 待归档计划: ${pendingMoves.length} 个`);

  // 5. 生成报告
  const report: GardenReport = {
    generatedAt: now.toISOString(),
    expiredDocs,
    brokenLinks,
    orphanedDocs,
    pendingMoves,
  };

  const reportContent = generateReportMarkdown(report);

  // 确保输出目录存在
  const outputDir = path.join(projectRoot, 'docs', 'generated');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 写入报告
  const outputPath = path.join(outputDir, 'doc-gardener-report.md');
  fs.writeFileSync(outputPath, reportContent, 'utf-8');

  console.log(`[doc-gardener] 报告已写入: ${path.relative(projectRoot, outputPath)}`);
  console.log('[doc-gardener] 扫描完成。');
}

// 导出内部函数供测试使用
export {
  findProjectRoot,
  scanMarkdownFiles,
  parseFrontmatterLastVerified,
  parseFrontmatterStatus,
  daysBetween,
  extractRelativeLinks,
  extractReferencedDocs,
  allCheckboxesCompleted,
  scanExpiredDocs,
  scanBrokenLinks,
  scanOrphanedDocs,
  scanPendingMoves,
  generateReportMarkdown,
  EXPIRY_THRESHOLD_DAYS,
};

// 导出类型供外部使用
export type { GardenReport, ExpiredDoc, BrokenLink, PendingMove };

// 仅在直接执行时运行（非测试导入时）
const isDirectExecution = process.argv[1]?.endsWith('index.js') || process.argv[1]?.endsWith('index.ts');
if (isDirectExecution) {
  main().catch((err: unknown) => {
    console.error('[doc-gardener] 执行失败:', err);
    process.exit(1);
  });
}
