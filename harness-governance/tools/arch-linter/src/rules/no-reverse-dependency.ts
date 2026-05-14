/**
 * 规则：no-reverse-dependency
 *
 * 校验分层依赖方向，禁止反向依赖。
 *
 * 后端分层顺序：types → config → repo → service → runtime
 * 前端分层顺序：types → api-client → hooks → components → pages
 *
 * 低层级模块不得引用高层级模块（即索引小的不得 import 索引大的）。
 *
 * @module rules/no-reverse-dependency
 * @validates Requirements 6.4, 6.5, 7.2
 */

import type { LintRule, LintContext, LintViolation } from '../types.js';

/**
 * 后端分层顺序（索引越小层级越低，低层级不得引用高层级）
 */
const BACKEND_LAYERS = ['types', 'config', 'repo', 'service', 'runtime'];

/**
 * 前端分层顺序（索引越小层级越低，低层级不得引用高层级）
 */
const FRONTEND_LAYERS = ['types', 'api-client', 'hooks', 'components', 'pages'];

/**
 * 判断文件是否属于后端域文件
 *
 * @param relativePath - 文件相对路径
 * @returns 是否为后端域文件
 */
function isBackendDomainFile(relativePath: string): boolean {
  return relativePath.startsWith('backend/src/domains/');
}

/**
 * 判断文件是否属于前端源文件
 *
 * @param relativePath - 文件相对路径
 * @returns 是否为前端源文件
 */
function isFrontendFile(relativePath: string): boolean {
  return relativePath.startsWith('frontend/src/');
}

/**
 * 获取后端域文件的层级
 *
 * 路径格式：backend/src/domains/<domain>/<layer>/...
 * @param relativePath - 文件相对路径
 * @returns 层级名称，若无法识别则返回 null
 */
function getBackendLayer(relativePath: string): string | null {
  const prefix = 'backend/src/domains/';
  if (!relativePath.startsWith(prefix)) {
    return null;
  }

  const afterPrefix = relativePath.slice(prefix.length);
  const parts = afterPrefix.split('/');

  // parts[0] = domain名, parts[1] = layer名
  if (parts.length < 2) {
    return null;
  }

  const layerName = parts[1];
  if (BACKEND_LAYERS.includes(layerName)) {
    return layerName;
  }

  return null;
}

/**
 * 获取前端文件的层级
 *
 * 路径格式：frontend/src/<layer>/...
 * @param relativePath - 文件相对路径
 * @returns 层级名称，若无法识别则返回 null
 */
function getFrontendLayer(relativePath: string): string | null {
  const prefix = 'frontend/src/';
  if (!relativePath.startsWith(prefix)) {
    return null;
  }

  const afterPrefix = relativePath.slice(prefix.length);
  const parts = afterPrefix.split('/');

  if (parts.length < 1) {
    return null;
  }

  const layerName = parts[0];
  if (FRONTEND_LAYERS.includes(layerName)) {
    return layerName;
  }

  return null;
}

/**
 * 从 import 路径中推断目标层级（后端域内 import）
 *
 * 支持相对路径和绝对路径形式的 import。
 * @param importPath - import 语句中的模块路径
 * @param currentFilePath - 当前文件的相对路径
 * @returns 目标层级名称，若无法识别则返回 null
 */
function resolveBackendImportLayer(importPath: string, currentFilePath: string): string | null {
  // 处理相对路径 import
  if (importPath.startsWith('.')) {
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

    const resolvedPath = pathParts.join('/');

    // 从解析后的路径中提取层级
    const prefix = 'backend/src/domains/';
    if (resolvedPath.startsWith(prefix)) {
      const afterPrefix = resolvedPath.slice(prefix.length);
      const parts = afterPrefix.split('/');
      if (parts.length >= 2 && BACKEND_LAYERS.includes(parts[1])) {
        return parts[1];
      }
    }
  }

  // 检查 import 路径中是否直接包含层级名称
  for (const layer of BACKEND_LAYERS) {
    if (importPath.includes(`/${layer}/`) || importPath.includes(`/${layer}`)) {
      return layer;
    }
  }

  return null;
}

/**
 * 从 import 路径中推断目标层级（前端 import）
 *
 * @param importPath - import 语句中的模块路径
 * @param currentFilePath - 当前文件的相对路径
 * @returns 目标层级名称，若无法识别则返回 null
 */
function resolveFrontendImportLayer(importPath: string, currentFilePath: string): string | null {
  // 处理相对路径 import
  if (importPath.startsWith('.')) {
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

    const resolvedPath = pathParts.join('/');

    // 从解析后的路径中提取层级
    const prefix = 'frontend/src/';
    if (resolvedPath.startsWith(prefix)) {
      const afterPrefix = resolvedPath.slice(prefix.length);
      const parts = afterPrefix.split('/');
      if (parts.length >= 1 && FRONTEND_LAYERS.includes(parts[0])) {
        return parts[0];
      }
    }
  }

  // 检查 import 路径中是否直接包含层级名称
  for (const layer of FRONTEND_LAYERS) {
    if (importPath.includes(`/${layer}/`) || importPath.includes(`/${layer}`)) {
      return layer;
    }
  }

  return null;
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
 * no-reverse-dependency 规则实现
 *
 * 校验所有 import 语句是否遵循分层依赖方向：
 * - 后端：types → config → repo → service → runtime（禁止反向）
 * - 前端：types → api-client → hooks → components → pages（禁止反向）
 */
export const noReverseDependencyRule: LintRule = {
  name: 'no-reverse-dependency',
  description: '禁止反向依赖：低层级模块不得引用高层级模块',

  check(context: LintContext): LintViolation[] {
    const violations: LintViolation[] = [];

    for (const file of context.files) {
      const { relativePath, content } = file;

      // 检查后端域文件
      if (isBackendDomainFile(relativePath)) {
        const currentLayer = getBackendLayer(relativePath);
        if (currentLayer == null) {
          continue;
        }

        const currentIndex = BACKEND_LAYERS.indexOf(currentLayer);
        const imports = parseImports(content);

        for (const imp of imports) {
          const targetLayer = resolveBackendImportLayer(imp.modulePath, relativePath);
          if (targetLayer == null) {
            continue;
          }

          const targetIndex = BACKEND_LAYERS.indexOf(targetLayer);

          // 反向依赖：当前层级索引 < 目标层级索引（低层级引用了高层级）
          if (targetIndex > currentIndex) {
            violations.push({
              filePath: relativePath,
              ruleName: 'no-reverse-dependency',
              message: `层级 "${currentLayer}" 不得引用层级 "${targetLayer}"（反向依赖）`,
              fixHint: `将依赖方向调整为 ${BACKEND_LAYERS.join(' → ')}，或通过 Providers 接口注入`,
              docLink: 'docs/design-docs/golden-principles.md#分层依赖方向',
              line: imp.line,
            });
          }
        }
      }

      // 检查前端文件
      if (isFrontendFile(relativePath)) {
        const currentLayer = getFrontendLayer(relativePath);
        if (currentLayer == null) {
          continue;
        }

        const currentIndex = FRONTEND_LAYERS.indexOf(currentLayer);
        const imports = parseImports(content);

        for (const imp of imports) {
          const targetLayer = resolveFrontendImportLayer(imp.modulePath, relativePath);
          if (targetLayer == null) {
            continue;
          }

          const targetIndex = FRONTEND_LAYERS.indexOf(targetLayer);

          // 反向依赖：当前层级索引 < 目标层级索引
          if (targetIndex > currentIndex) {
            violations.push({
              filePath: relativePath,
              ruleName: 'no-reverse-dependency',
              message: `层级 "${currentLayer}" 不得引用层级 "${targetLayer}"（反向依赖）`,
              fixHint: `将依赖方向调整为 ${FRONTEND_LAYERS.join(' → ')}，或提取到更低层级`,
              docLink: 'docs/design-docs/golden-principles.md#分层依赖方向',
              line: imp.line,
            });
          }
        }
      }
    }

    return violations;
  },
};
