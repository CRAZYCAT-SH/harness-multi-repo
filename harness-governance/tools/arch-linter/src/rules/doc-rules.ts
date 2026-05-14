/**
 * 文档校验规则集
 *
 * 包含三条文档相关的架构不变式规则：
 * 1. agents-md-valid — 校验 AGENTS.md 存在、行数 ≤ 100、链接有效
 * 2. doc-frontmatter-valid — 校验文档 YAML frontmatter 完整性
 * 3. dependency-documented — 校验所有直接依赖在 tech-stack.md 中有记录
 *
 * @module rules/doc-rules
 * @see Requirements 1.6, 1.7, 2.7, 12.6
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LintRule, LintContext, LintViolation } from '../types.js';

// ============================================================================
// 规则 1: agents-md-valid
// ============================================================================

/**
 * 从 markdown 内容中提取所有相对路径链接
 *
 * 匹配 [text](path) 格式的链接，排除以 http:// 或 https:// 开头的绝对 URL。
 *
 * @param content - markdown 文件内容
 * @returns 相对路径链接数组，每项包含链接路径和所在行号
 */
function extractRelativeLinks(content: string): Array<{ link: string; line: number }> {
  const results: Array<{ link: string; line: number }> = [];
  const lines = content.split('\n');

  // 匹配 markdown 链接格式 [text](path)
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;

  for (let i = 0; i < lines.length; i++) {
    let match: RegExpExecArray | null;
    linkRegex.lastIndex = 0;

    while ((match = linkRegex.exec(lines[i])) !== null) {
      const linkTarget = match[2];
      // 排除绝对 URL（http/https）和锚点链接
      if (!linkTarget.startsWith('http://') && !linkTarget.startsWith('https://') && !linkTarget.startsWith('#')) {
        // 去除锚点部分（如 ./file.md#section）
        const cleanLink = linkTarget.split('#')[0];
        if (cleanLink.length > 0) {
          results.push({ link: cleanLink, line: i + 1 });
        }
      }
    }
  }

  return results;
}

/**
 * AGENTS.md 有效性校验规则
 *
 * 校验内容：
 * - AGENTS.md 文件存在于项目根目录
 * - AGENTS.md 总行数不超过 100 行
 * - AGENTS.md 中所有相对路径链接指向存在的文件
 *
 * 需要访问文件系统（使用 context.projectRoot）。
 */
export const agentsMdValidRule: LintRule = {
  name: 'agents-md-valid',
  description: '校验 AGENTS.md 存在、行数 ≤ 100、所有相对链接指向存在的文件',

  check(context: LintContext): LintViolation[] {
    const violations: LintViolation[] = [];
    const agentsPath = path.join(context.projectRoot, 'AGENTS.md');

    // 检查 AGENTS.md 是否存在
    if (!fs.existsSync(agentsPath)) {
      violations.push({
        filePath: 'AGENTS.md',
        ruleName: 'agents-md-valid',
        message: 'AGENTS.md 文件不存在于项目根目录',
        fixHint: '在项目根目录创建 AGENTS.md 文件，作为代理上下文入口索引',
        docLink: 'docs/design-docs/golden-principles.md#AGENTS-入口',
      });
      return violations;
    }

    // 读取文件内容
    const content = fs.readFileSync(agentsPath, 'utf-8');
    const lines = content.split('\n');

    // 检查行数是否超过 100 行
    if (lines.length > 100) {
      violations.push({
        filePath: 'AGENTS.md',
        ruleName: 'agents-md-valid',
        message: `AGENTS.md 共 ${lines.length} 行，超过上限 100 行`,
        fixHint: '精简 AGENTS.md 内容，仅保留目录索引与关键链接，将详细内容移至对应文档',
        docLink: 'docs/design-docs/golden-principles.md#AGENTS-入口',
      });
    }

    // 检查所有相对链接是否指向存在的文件
    const relativeLinks = extractRelativeLinks(content);
    for (const { link, line } of relativeLinks) {
      const targetPath = path.resolve(context.projectRoot, link);
      if (!fs.existsSync(targetPath)) {
        violations.push({
          filePath: 'AGENTS.md',
          ruleName: 'agents-md-valid',
          message: `链接 "${link}" 指向的文件不存在`,
          fixHint: `确认链接目标路径是否正确，或创建缺失的文件: ${link}`,
          docLink: 'docs/design-docs/golden-principles.md#AGENTS-入口',
          line,
        });
      }
    }

    return violations;
  },
};

// ============================================================================
// 规则 2: doc-frontmatter-valid
// ============================================================================

/** 合法的文档状态值 */
const VALID_STATUSES = ['draft', 'validated', 'deprecated', 'superseded'];

/** ISO 8601 日期格式正则（支持 YYYY-MM-DD 和完整 ISO 格式） */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * 需要校验 frontmatter 的文档目录列表（相对于项目根目录）
 */
const DOC_DIRECTORIES = [
  'docs/design-docs',
  'docs/exec-plans',
  'docs/product-specs',
];

/**
 * 解析 markdown 文件的 YAML frontmatter
 *
 * frontmatter 位于文件开头，由两行 --- 包围。
 * 返回解析后的键值对，如果没有 frontmatter 则返回 null。
 *
 * @param content - markdown 文件内容
 * @returns frontmatter 键值对，或 null（无 frontmatter）
 */
function parseFrontmatter(content: string): Record<string, string> | null {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) {
    return null;
  }

  // 查找第二个 --- 分隔符
  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) {
    return null;
  }

  const frontmatterBlock = trimmed.substring(3, endIndex).trim();
  if (frontmatterBlock.length === 0) {
    return null;
  }

  // 简单解析 YAML 键值对（key: value 格式）
  const result: Record<string, string> = {};
  const lines = frontmatterBlock.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();

    // 去除引号
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key.length > 0) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * 递归扫描目录下所有 .md 文件
 *
 * @param dir - 要扫描的目录绝对路径
 * @param projectRoot - 项目根目录路径
 * @returns markdown 文件的相对路径数组
 */
function scanMarkdownFiles(dir: string, projectRoot: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...scanMarkdownFiles(fullPath, projectRoot));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');
      results.push(relativePath);
    }
  }

  return results;
}

/**
 * 文档 Frontmatter 有效性校验规则
 *
 * 校验内容：
 * - docs/design-docs/、docs/exec-plans/、docs/product-specs/ 下的 .md 文件
 * - 每份文档必须有 YAML frontmatter，包含 status 字段（draft|validated|deprecated|superseded）
 * - 每份文档必须有 last_verified 字段（ISO 8601 日期格式）
 * - 如果 status 为 superseded，必须有 superseded_by 字段
 * - 跳过 index.md 文件（它们可能不需要 frontmatter）
 *
 * 需要访问文件系统（使用 context.projectRoot）。
 */
export const docFrontmatterValidRule: LintRule = {
  name: 'doc-frontmatter-valid',
  description: '校验文档 YAML frontmatter 包含合法的 status 和 last_verified 字段',

  check(context: LintContext): LintViolation[] {
    const violations: LintViolation[] = [];

    for (const docDir of DOC_DIRECTORIES) {
      const absoluteDir = path.join(context.projectRoot, docDir);
      const mdFiles = scanMarkdownFiles(absoluteDir, context.projectRoot);

      for (const relativePath of mdFiles) {
        // 跳过 index.md 文件
        const fileName = path.basename(relativePath);
        if (fileName === 'index.md') {
          continue;
        }

        // 读取文件内容
        const absolutePath = path.join(context.projectRoot, relativePath);
        const content = fs.readFileSync(absolutePath, 'utf-8');

        // 解析 frontmatter
        const frontmatter = parseFrontmatter(content);

        if (frontmatter === null) {
          violations.push({
            filePath: relativePath,
            ruleName: 'doc-frontmatter-valid',
            message: '文档缺少 YAML frontmatter',
            fixHint: '在文件开头添加 YAML frontmatter，包含 status 和 last_verified 字段',
            docLink: 'docs/design-docs/golden-principles.md#文档元数据',
          });
          continue;
        }

        // 检查 status 字段
        if (!frontmatter['status']) {
          violations.push({
            filePath: relativePath,
            ruleName: 'doc-frontmatter-valid',
            message: 'frontmatter 缺少 status 字段',
            fixHint: '在 frontmatter 中添加 status 字段，取值为 draft|validated|deprecated|superseded',
            docLink: 'docs/design-docs/golden-principles.md#文档元数据',
          });
        } else if (!VALID_STATUSES.includes(frontmatter['status'])) {
          violations.push({
            filePath: relativePath,
            ruleName: 'doc-frontmatter-valid',
            message: `status 字段值 "${frontmatter['status']}" 不合法，应为 draft|validated|deprecated|superseded`,
            fixHint: '将 status 字段修改为合法值：draft、validated、deprecated 或 superseded',
            docLink: 'docs/design-docs/golden-principles.md#文档元数据',
          });
        }

        // 检查 last_verified 字段
        if (!frontmatter['last_verified']) {
          violations.push({
            filePath: relativePath,
            ruleName: 'doc-frontmatter-valid',
            message: 'frontmatter 缺少 last_verified 字段',
            fixHint: '在 frontmatter 中添加 last_verified 字段，格式为 ISO 8601 日期（如 2025-01-15）',
            docLink: 'docs/design-docs/golden-principles.md#文档元数据',
          });
        } else if (!ISO_DATE_REGEX.test(frontmatter['last_verified'])) {
          violations.push({
            filePath: relativePath,
            ruleName: 'doc-frontmatter-valid',
            message: `last_verified 字段值 "${frontmatter['last_verified']}" 不是合法的 ISO 8601 日期格式`,
            fixHint: '将 last_verified 修改为 ISO 8601 日期格式，如 2025-01-15',
            docLink: 'docs/design-docs/golden-principles.md#文档元数据',
          });
        }

        // 如果 status 为 superseded，检查 superseded_by 字段
        if (frontmatter['status'] === 'superseded' && !frontmatter['superseded_by']) {
          violations.push({
            filePath: relativePath,
            ruleName: 'doc-frontmatter-valid',
            message: 'status 为 superseded 但缺少 superseded_by 字段',
            fixHint: '在 frontmatter 中添加 superseded_by 字段，指向替代文档的相对路径',
            docLink: 'docs/design-docs/golden-principles.md#文档元数据',
          });
        }
      }
    }

    return violations;
  },
};

// ============================================================================
// 规则 3: dependency-documented
// ============================================================================

/**
 * 需要检查的 package.json 文件路径列表（相对于项目根目录）
 */
const PACKAGE_JSON_PATHS = [
  'package.json',
  'backend/package.json',
  'frontend/package.json',
];

/**
 * 从 package.json 中提取直接依赖名称列表
 *
 * 仅提取 dependencies 字段中的依赖，不包含 devDependencies。
 *
 * @param packageJsonPath - package.json 文件的绝对路径
 * @returns 依赖名称数组，如果文件不存在则返回空数组
 */
function extractDirectDependencies(packageJsonPath: string): string[] {
  if (!fs.existsSync(packageJsonPath)) {
    return [];
  }

  const content = fs.readFileSync(packageJsonPath, 'utf-8');
  const pkg = JSON.parse(content) as { dependencies?: Record<string, string> };

  if (!pkg.dependencies) {
    return [];
  }

  return Object.keys(pkg.dependencies);
}

/**
 * 读取 tech-stack.md 并提取已记录的依赖名称集合
 *
 * 从 tech-stack.md 的表格中提取第一列（依赖名称），
 * 同时也检查文档正文中是否提及该依赖名称。
 *
 * @param techStackPath - tech-stack.md 文件的绝对路径
 * @returns 已记录的依赖名称集合
 */
function extractDocumentedDependencies(techStackPath: string): Set<string> {
  const documented = new Set<string>();

  if (!fs.existsSync(techStackPath)) {
    return documented;
  }

  const content = fs.readFileSync(techStackPath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    // 匹配表格行格式：| 依赖名称 | ... |
    const tableMatch = line.match(/^\|\s*([^|]+?)\s*\|/);
    if (tableMatch) {
      const cellValue = tableMatch[1].trim();
      // 排除表头和分隔行
      if (cellValue && cellValue !== '依赖名称' && !cellValue.startsWith('-')) {
        documented.add(cellValue);
      }
    }

    // 也检查行内是否以反引号包裹提及依赖名（如 `fastify`）
    const backtickMatches = line.matchAll(/`([^`]+)`/g);
    for (const match of backtickMatches) {
      documented.add(match[1]);
    }
  }

  return documented;
}

/**
 * 依赖文档化校验规则
 *
 * 校验内容：
 * - 读取工作区中所有 package.json（根目录、backend、frontend）
 * - 对每个直接依赖（非 devDependency），检查是否在 docs/design-docs/tech-stack.md 中有记录
 * - 对未记录的依赖报告违规
 *
 * 需要访问文件系统（使用 context.projectRoot）。
 */
export const dependencyDocumentedRule: LintRule = {
  name: 'dependency-documented',
  description: '校验 package.json 中的每条直接依赖在 tech-stack.md 中存在对应条目',

  check(context: LintContext): LintViolation[] {
    const violations: LintViolation[] = [];
    const techStackPath = path.join(context.projectRoot, 'docs', 'design-docs', 'tech-stack.md');

    // 获取已记录的依赖集合
    const documentedDeps = extractDocumentedDependencies(techStackPath);

    // 检查每个 package.json 中的直接依赖
    for (const pkgRelPath of PACKAGE_JSON_PATHS) {
      const pkgAbsPath = path.join(context.projectRoot, pkgRelPath);
      const dependencies = extractDirectDependencies(pkgAbsPath);

      for (const dep of dependencies) {
        // 检查依赖名称是否在 tech-stack.md 中有记录
        // 对于 scoped 包（如 @opentelemetry/sdk-node），也检查 scope 前缀（如 @opentelemetry/*）
        const isDocumented = documentedDeps.has(dep) ||
          documentedDeps.has(dep.replace(/^@/, '')) ||
          (dep.startsWith('@') && documentedDeps.has(dep.split('/')[0] + '/*'));

        if (!isDocumented) {
          violations.push({
            filePath: pkgRelPath,
            ruleName: 'dependency-documented',
            message: `直接依赖 "${dep}" 未在 docs/design-docs/tech-stack.md 中记录`,
            fixHint: `在 docs/design-docs/tech-stack.md 的依赖清单表格中添加 "${dep}" 的条目，包含版本、用途、选型理由和代理可读性评分`,
            docLink: 'docs/design-docs/tech-stack.md#新增依赖流程',
          });
        }
      }
    }

    return violations;
  },
};
