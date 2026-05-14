/**
 * 规则：no-cross-domain-import
 *
 * 校验跨域引用约束：不同业务域之间不得直接引用内部文件。
 * 跨域通信必须通过域的公开入口（index.ts）或 Providers 接口。
 *
 * 例如：
 * - ❌ `domains/task/service/task.service.ts` import from `domains/auth/repo/auth.repo.ts`
 * - ✅ `domains/task/service/task.service.ts` import from `domains/auth/index`
 * - ✅ `domains/task/service/task.service.ts` import from `../../providers/auth.provider`
 *
 * @module rules/no-cross-domain-import
 * @validates Requirements 6.5, 7.2
 */

import type { LintRule, LintContext, LintViolation } from '../types.js';

/**
 * 从文件相对路径中提取所属域名
 *
 * 路径格式：backend/src/domains/<domain>/...
 * @param relativePath - 相对于项目根目录的文件路径（使用 / 分隔）
 * @returns 域名，若不属于任何域则返回 null
 */
function getDomainName(relativePath: string): string | null {
  const prefix = 'backend/src/domains/';
  if (!relativePath.startsWith(prefix)) {
    return null;
  }

  const afterPrefix = relativePath.slice(prefix.length);
  const parts = afterPrefix.split('/');

  if (parts.length < 1 || parts[0] === '') {
    return null;
  }

  return parts[0];
}

/**
 * 解析文件内容中的所有 import 语句
 *
 * @param content - 文件内容
 * @returns import 信息数组，包含模块路径和行号
 */
function parseImports(content: string): Array<{ modulePath: string; line: number }> {
  const imports: Array<{ modulePath: string; line: number }> = [];
  const lines = content.split('\n');

  const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(importRegex);
    if (match) {
      imports.push({ modulePath: match[1], line: i + 1 });
    }
  }

  return imports;
}

/**
 * 将相对 import 路径解析为完整的相对路径
 *
 * @param importPath - import 语句中的模块路径
 * @param currentFilePath - 当前文件的相对路径
 * @returns 解析后的完整相对路径，若非相对路径则返回 null
 */
function resolveRelativeImport(importPath: string, currentFilePath: string): string | null {
  if (!importPath.startsWith('.')) {
    return null;
  }

  const currentDir = currentFilePath.split('/').slice(0, -1).join('/');
  const segments = importPath.split('/');
  const pathParts = currentDir.split('/');

  for (const segment of segments) {
    if (segment === '.') {
      continue;
    } else if (segment === '..') {
      pathParts.pop();
    } else {
      pathParts.push(segment);
    }
  }

  return pathParts.join('/');
}

/**
 * 判断 import 是否指向另一个域的内部文件（非公开入口）
 *
 * 合法的跨域引用：
 * - 引用 `domains/<otherDomain>/index`（公开入口）
 * - 引用 `domains/<otherDomain>`（等同于 index）
 * - 引用 providers（不属于域内部）
 *
 * 非法的跨域引用：
 * - 引用 `domains/<otherDomain>/repo/xxx`
 * - 引用 `domains/<otherDomain>/service/xxx`
 * - 引用 `domains/<otherDomain>/types/xxx`（直接引用内部文件）
 *
 * @param resolvedPath - 解析后的完整相对路径
 * @param currentDomain - 当前文件所属域名
 * @returns 违规信息，若合法则返回 null
 */
function checkCrossDomainViolation(
  resolvedPath: string,
  currentDomain: string
): { targetDomain: string } | null {
  const prefix = 'backend/src/domains/';

  if (!resolvedPath.startsWith(prefix)) {
    return null;
  }

  const afterPrefix = resolvedPath.slice(prefix.length);
  const parts = afterPrefix.split('/');

  if (parts.length < 1 || parts[0] === '') {
    return null;
  }

  const targetDomain = parts[0];

  // 同域引用，不检查
  if (targetDomain === currentDomain) {
    return null;
  }

  // shared 域允许被所有域引用
  if (targetDomain === 'shared') {
    return null;
  }

  // 检查是否通过公开入口引用
  // 合法形式：domains/<domain>/index 或 domains/<domain>（仅域名，无子路径）
  if (parts.length === 1) {
    // import from '...domains/auth' — 等同于 index
    return null;
  }

  if (parts.length === 2 && (parts[1] === 'index' || parts[1] === 'index.ts' || parts[1] === 'index.js')) {
    // import from '...domains/auth/index'
    return null;
  }

  // 其他情况均为非法跨域引用
  return { targetDomain };
}

/**
 * no-cross-domain-import 规则实现
 *
 * 校验后端域之间的引用约束：
 * - 不同域之间不得直接引用内部文件
 * - 跨域通信必须通过域的 index.ts 公开入口或 Providers 接口
 */
export const noCrossDomainImportRule: LintRule = {
  name: 'no-cross-domain-import',
  description: '禁止跨域直接引用内部文件，跨域通信必须通过 index.ts 公开入口或 Providers',

  check(context: LintContext): LintViolation[] {
    const violations: LintViolation[] = [];

    for (const file of context.files) {
      const { relativePath, content } = file;

      // 仅检查后端域文件
      const currentDomain = getDomainName(relativePath);
      if (currentDomain == null) {
        continue;
      }

      const imports = parseImports(content);

      for (const imp of imports) {
        // 解析相对路径 import
        const resolvedPath = resolveRelativeImport(imp.modulePath, relativePath);
        if (resolvedPath == null) {
          // 非相对路径（如 npm 包），跳过
          continue;
        }

        // 检查是否存在跨域违规
        const violation = checkCrossDomainViolation(resolvedPath, currentDomain);
        if (violation != null) {
          violations.push({
            filePath: relativePath,
            ruleName: 'no-cross-domain-import',
            message: `域 "${currentDomain}" 不得直接引用域 "${violation.targetDomain}" 的内部文件`,
            fixHint: `改为引用 "domains/${violation.targetDomain}/index.ts" 公开入口，或通过 Providers 接口注入`,
            docLink: 'docs/design-docs/golden-principles.md#跨域通信',
            line: imp.line,
          });
        }
      }
    }

    return violations;
  },
};
