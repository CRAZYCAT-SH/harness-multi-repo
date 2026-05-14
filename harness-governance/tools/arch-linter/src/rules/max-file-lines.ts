/**
 * 单文件最大有效行数规则
 *
 * 校验单个文件的有效行数不超过 500 行。
 * 有效行数 = 总行数 - 空行 - 纯注释行
 *
 * 空行定义：仅包含空白字符的行
 * 纯注释行定义：
 *   - 仅包含 // 单行注释的行（前后可有空白）
 *   - 位于 /* ... *​/ 多行注释块内部的行
 *
 * @module rules/max-file-lines
 * @see Requirements 7.4
 */

import type { LintRule, LintContext, LintViolation } from '../types.js';

/** 有效行数上限 */
const MAX_EFFECTIVE_LINES = 500;

/**
 * 计算文件的有效行数
 *
 * 有效行数 = 总行数 - 空行 - 纯注释行
 *
 * 处理逻辑：
 * 1. 按换行符分割文件内容为行数组
 * 2. 遍历每一行，跟踪是否处于多行注释块内
 * 3. 空行（仅空白字符）不计入有效行
 * 4. 纯 // 注释行不计入有效行
 * 5. 多行注释块（/* ... *​/）内的行不计入有效行
 * 6. 其余行计为有效行
 *
 * @param content - 文件内容字符串
 * @returns 有效行数
 */
export function countEffectiveLines(content: string): number {
  const lines = content.split('\n');
  let effectiveCount = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // 处理多行注释块
    if (inBlockComment) {
      // 检查是否在本行结束多行注释
      if (trimmed.includes('*/')) {
        inBlockComment = false;
        // 检查 */ 之后是否还有代码
        const afterClose = trimmed.substring(trimmed.indexOf('*/') + 2).trim();
        if (afterClose.length > 0) {
          effectiveCount++;
        }
      }
      // 多行注释块内的行不计入有效行
      continue;
    }

    // 空行：仅包含空白字符
    if (trimmed.length === 0) {
      continue;
    }

    // 检查是否开始多行注释
    if (trimmed.startsWith('/*')) {
      // 检查是否在同一行内闭合
      if (trimmed.includes('*/')) {
        // 单行内的 /* ... */ 注释
        // 检查注释前后是否有代码
        const beforeOpen = line.substring(0, line.indexOf('/*')).trim();
        const afterClose = trimmed.substring(trimmed.indexOf('*/') + 2).trim();
        if (beforeOpen.length > 0 || afterClose.length > 0) {
          effectiveCount++;
        }
        // 否则整行都是注释，不计入
      } else {
        // 多行注释开始，检查 /* 之前是否有代码
        const beforeOpen = line.substring(0, line.indexOf('/*')).trim();
        if (beforeOpen.length > 0) {
          effectiveCount++;
        }
        inBlockComment = true;
      }
      continue;
    }

    // 纯单行注释：以 // 开头的行
    if (trimmed.startsWith('//')) {
      continue;
    }

    // 其余情况为有效代码行
    effectiveCount++;
  }

  return effectiveCount;
}

/**
 * 单文件最大有效行数规则实例
 *
 * 对所有源文件计算有效行数，超过 500 行时报告违规。
 */
export const maxFileLinesRule: LintRule = {
  name: 'max-file-lines',
  description: '校验单文件有效行数不超过 500 行（不含空行与纯注释行）',

  check(context: LintContext): LintViolation[] {
    const violations: LintViolation[] = [];

    for (const file of context.files) {
      const effectiveLines = countEffectiveLines(file.content);

      if (effectiveLines > MAX_EFFECTIVE_LINES) {
        violations.push({
          filePath: file.relativePath,
          ruleName: 'max-file-lines',
          message: `文件有效行数为 ${effectiveLines} 行，超过上限 ${MAX_EFFECTIVE_LINES} 行`,
          fixHint: '将文件拆分为多个更小的模块，每个模块聚焦单一职责',
          docLink: 'docs/design-docs/golden-principles.md#单文件行数限制',
        });
      }
    }

    return violations;
  },
};
