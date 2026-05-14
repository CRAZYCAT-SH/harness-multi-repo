/**
 * 文件命名约定规则
 *
 * 校验 backend/src/domains/ 下各层目录中的文件命名是否符合约定：
 * - repo/ 目录下的文件必须匹配 *.repo.ts
 * - service/ 目录下的文件必须匹配 *.service.ts
 * - runtime/ 目录下的文件必须匹配 *.runtime.ts
 * - index.ts 在任何目录下都允许存在（例外）
 *
 * @module rules/file-naming-convention
 * @see Requirements 7.3
 */

import type { LintRule, LintContext, LintViolation } from '../types.js';

/**
 * 层目录与对应命名模式的映射
 *
 * key 为层目录名称，value 为该层文件应匹配的后缀正则。
 */
const LAYER_PATTERNS: Record<string, RegExp> = {
  repo: /\.repo\.ts$/,
  service: /\.service\.ts$/,
  runtime: /\.runtime\.ts$/,
};

/**
 * 文件命名约定规则实例
 *
 * 仅检查 backend/src/domains/ 下的文件。
 * 对于 repo/、service/、runtime/ 层目录中的文件，
 * 校验其文件名是否符合对应的命名模式。
 * index.ts 始终被允许，不触发违规。
 */
export const fileNamingConventionRule: LintRule = {
  name: 'file-naming-convention',
  description: '校验 domain 层目录中的文件命名约定（repo/*.repo.ts、service/*.service.ts、runtime/*.runtime.ts）',

  check(context: LintContext): LintViolation[] {
    const violations: LintViolation[] = [];

    for (const file of context.files) {
      // 仅检查 backend/src/domains/ 下的文件
      if (!file.relativePath.startsWith('backend/src/domains/')) {
        continue;
      }

      // 提取域路径后的部分，例如 "backend/src/domains/task/repo/task.repo.ts"
      // 分割后得到 ["backend", "src", "domains", "<domain>", "<layer>", ...]
      const segments = file.relativePath.split('/');

      // 至少需要 5 段才能确定层目录：backend/src/domains/<domain>/<layer>/...
      if (segments.length < 6) {
        continue;
      }

      // segments[4] 是层目录名称（repo、service、runtime 等）
      const layerDir = segments[4];
      const pattern = LAYER_PATTERNS[layerDir];

      // 如果不是需要校验命名的层目录，跳过
      if (!pattern) {
        continue;
      }

      // 获取文件名
      const fileName = segments[segments.length - 1];

      // index.ts 始终允许
      if (fileName === 'index.ts') {
        continue;
      }

      // 校验文件名是否匹配对应模式
      if (!pattern.test(fileName)) {
        violations.push({
          filePath: file.relativePath,
          ruleName: 'file-naming-convention',
          message: `文件 "${fileName}" 位于 ${layerDir}/ 目录下，但不符合 *.${layerDir}.ts 命名约定`,
          fixHint: `将文件重命名为 <name>.${layerDir}.ts 格式，例如 "task.${layerDir}.ts"`,
          docLink: 'docs/design-docs/golden-principles.md#文件命名约定',
        });
      }
    }

    return violations;
  },
};
