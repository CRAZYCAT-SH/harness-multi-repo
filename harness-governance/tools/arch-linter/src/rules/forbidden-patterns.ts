/**
 * 代码模式禁止规则
 *
 * 包含 4 条规则，用于检测业务代码中不应出现的代码模式：
 * 1. no-console-in-business — 禁止业务代码中使用 console.*
 * 2. no-any-type — 禁止使用 any 类型
 * 3. no-raw-env-access — 禁止直接访问 process.env
 * 4. no-raw-request-access — 禁止在 service 层直接访问 req.body/query/params
 *
 * @module rules/forbidden-patterns
 * @see Requirements 7.5, 8.7, 9.2
 */

import type { LintRule, LintContext, LintViolation } from '../types.js';

/**
 * console 方法调用的正则匹配模式
 *
 * 匹配 console.log、console.error、console.warn、console.info
 */
const CONSOLE_PATTERN = /\bconsole\.(log|error|warn|info)\b/;

/**
 * any 类型使用的正则匹配模式
 *
 * 匹配 `: any`、`as any`、`<any>` 三种常见用法
 */
const ANY_TYPE_PATTERNS = [
  /:\s*any\b/,       // : any（类型注解）
  /\bas\s+any\b/,    // as any（类型断言）
  /<any>/,           // <any>（泛型参数）
];

/**
 * process.env 直接访问的正则匹配模式
 */
const PROCESS_ENV_PATTERN = /\bprocess\.env\b/;

/**
 * 请求对象直接访问的正则匹配模式
 *
 * 匹配 req.body、req.query、req.params
 */
const RAW_REQUEST_PATTERNS = [
  /\breq\.body\b/,
  /\breq\.query\b/,
  /\breq\.params\b/,
];

/**
 * 判断文件路径是否属于业务代码区域（需要禁止 console 的区域）
 *
 * 业务代码区域包括：
 * - backend/src/domains/ 下的所有文件
 * - frontend/src/ 下的所有文件
 *
 * 排除区域（允许 console）：
 * - tools/ 下的所有文件
 * - providers/logger.provider.ts
 *
 * @param relativePath - 文件相对路径
 * @returns 是否属于需要检查 console 的业务代码区域
 */
function isBusinessCode(relativePath: string): boolean {
  // 允许 tools/ 目录
  if (relativePath.startsWith('tools/')) {
    return false;
  }

  // 允许 logger provider
  if (relativePath.includes('providers/logger.provider.ts')) {
    return false;
  }

  // 检查是否在业务代码区域
  if (relativePath.startsWith('backend/src/domains/')) {
    return true;
  }
  if (relativePath.startsWith('frontend/src/')) {
    return true;
  }

  return false;
}

/**
 * 判断文件是否为 TypeScript 源文件（非测试文件）
 *
 * 排除测试文件：
 * - __tests__/ 目录下的文件
 * - *.test.ts 文件
 * - *.spec.ts 文件
 *
 * @param relativePath - 文件相对路径
 * @returns 是否为需要检查 any 类型的源文件
 */
function isNonTestTypeScriptFile(relativePath: string): boolean {
  // 必须是 .ts 或 .tsx 文件
  if (!relativePath.endsWith('.ts') && !relativePath.endsWith('.tsx')) {
    return false;
  }

  // 排除测试文件
  if (relativePath.includes('__tests__/')) {
    return false;
  }
  if (relativePath.endsWith('.test.ts') || relativePath.endsWith('.test.tsx')) {
    return false;
  }
  if (relativePath.endsWith('.spec.ts') || relativePath.endsWith('.spec.tsx')) {
    return false;
  }

  return true;
}

/**
 * 判断文件是否在需要检查 any 类型的代码区域
 *
 * 检查区域：backend/src 和 frontend/src
 *
 * @param relativePath - 文件相对路径
 * @returns 是否在检查区域内
 */
function isInAnyCheckScope(relativePath: string): boolean {
  if (relativePath.startsWith('backend/src/')) {
    return true;
  }
  if (relativePath.startsWith('frontend/src/')) {
    return true;
  }
  return false;
}

/**
 * 判断文件是否在需要检查 process.env 的区域
 *
 * 检查区域：service/ 和 runtime/ 目录
 * 排除区域：
 * - boundary/env.schema.ts（环境变量解析的合法位置）
 * - tools/ 目录
 * - 测试文件
 *
 * @param relativePath - 文件相对路径
 * @returns 是否需要检查 process.env 使用
 */
function shouldCheckEnvAccess(relativePath: string): boolean {
  // 允许 boundary/env.schema.ts
  if (relativePath.includes('boundary/env.schema.ts')) {
    return false;
  }

  // 允许 tools/ 目录
  if (relativePath.startsWith('tools/')) {
    return false;
  }

  // 允许测试文件
  if (relativePath.includes('__tests__/') ||
      relativePath.endsWith('.test.ts') ||
      relativePath.endsWith('.test.tsx') ||
      relativePath.endsWith('.spec.ts') ||
      relativePath.endsWith('.spec.tsx')) {
    return false;
  }

  // 仅检查 service/ 和 runtime/ 目录下的文件
  if (relativePath.includes('/service/') || relativePath.includes('/runtime/')) {
    return true;
  }

  return false;
}

/**
 * 判断文件是否在需要检查 req.body/query/params 的区域
 *
 * 检查区域：service/ 目录
 * 排除区域：runtime/ 层文件（边界解析的合法位置）
 *
 * @param relativePath - 文件相对路径
 * @returns 是否需要检查原始请求访问
 */
function shouldCheckRequestAccess(relativePath: string): boolean {
  // 允许 runtime/ 层文件（边界解析发生在此处）
  if (relativePath.includes('/runtime/')) {
    return false;
  }

  // 仅检查 service/ 目录下的文件
  if (relativePath.includes('/service/')) {
    return true;
  }

  return false;
}

/**
 * 判断行是否为注释行（应跳过检查）
 *
 * @param line - 代码行内容
 * @returns 是否为注释行
 */
function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

// ============================================================
// 规则 1: no-console-in-business
// ============================================================

/**
 * 禁止业务代码中使用 console 规则
 *
 * 检测 console.log、console.error、console.warn、console.info 的使用。
 * 仅检查 backend/src/domains/ 和 frontend/src/ 下的文件。
 * 允许在 tools/ 和 providers/logger.provider.ts 中使用。
 *
 * @see Requirements 7.5, 9.2
 */
export const noConsoleInBusinessRule: LintRule = {
  name: 'no-console-in-business',
  description: '禁止在业务代码中使用 console.log/error/warn/info，应通过 LoggerProvider 输出日志',

  check(context: LintContext): LintViolation[] {
    const violations: LintViolation[] = [];

    for (const file of context.files) {
      // 仅检查业务代码区域
      if (!isBusinessCode(file.relativePath)) {
        continue;
      }

      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 跳过注释行
        if (isCommentLine(line)) {
          continue;
        }

        if (CONSOLE_PATTERN.test(line)) {
          violations.push({
            filePath: file.relativePath,
            ruleName: 'no-console-in-business',
            message: `业务代码中禁止使用 console.*，请使用 LoggerProvider`,
            fixHint: '将 console.* 替换为注入的 LoggerProvider 方法（如 logger.info()、logger.error()）',
            docLink: 'docs/design-docs/golden-principles.md#禁止业务代码中console',
            line: i + 1,
          });
        }
      }
    }

    return violations;
  },
};

// ============================================================
// 规则 2: no-any-type
// ============================================================

/**
 * 禁止使用 any 类型规则
 *
 * 检测 `: any`、`as any`、`<any>` 模式的使用。
 * 检查 backend/src 和 frontend/src 下的所有 TypeScript 文件。
 * 排除测试文件（__tests__/、*.test.ts、*.spec.ts）。
 *
 * @see Requirements 8.7, 9.2
 */
export const noAnyTypeRule: LintRule = {
  name: 'no-any-type',
  description: '禁止在源代码中使用 any 类型（: any、as any、<any>），应使用具体类型或 unknown',

  check(context: LintContext): LintViolation[] {
    const violations: LintViolation[] = [];

    for (const file of context.files) {
      // 必须在检查范围内
      if (!isInAnyCheckScope(file.relativePath)) {
        continue;
      }

      // 必须是非测试的 TypeScript 文件
      if (!isNonTestTypeScriptFile(file.relativePath)) {
        continue;
      }

      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 跳过注释行
        if (isCommentLine(line)) {
          continue;
        }

        for (const pattern of ANY_TYPE_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              filePath: file.relativePath,
              ruleName: 'no-any-type',
              message: `禁止使用 any 类型，请使用具体类型或 unknown`,
              fixHint: '将 any 替换为具体的类型定义，或使用 unknown 配合类型守卫进行安全收窄',
              docLink: 'docs/design-docs/golden-principles.md#禁止any类型',
              line: i + 1,
            });
            break; // 每行只报告一次
          }
        }
      }
    }

    return violations;
  },
};

// ============================================================
// 规则 3: no-raw-env-access
// ============================================================

/**
 * 禁止直接访问 process.env 规则
 *
 * 检测 process.env 的使用。
 * 仅检查 service/ 和 runtime/ 目录下的文件。
 * 允许在 boundary/env.schema.ts（环境变量解析位置）、tools/ 和测试文件中使用。
 *
 * @see Requirements 8.7, 9.2
 */
export const noRawEnvAccessRule: LintRule = {
  name: 'no-raw-env-access',
  description: '禁止在 service/runtime 层直接访问 process.env，应通过 boundary/env.schema.ts 解析后注入',

  check(context: LintContext): LintViolation[] {
    const violations: LintViolation[] = [];

    for (const file of context.files) {
      // 仅检查需要校验的区域
      if (!shouldCheckEnvAccess(file.relativePath)) {
        continue;
      }

      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 跳过注释行
        if (isCommentLine(line)) {
          continue;
        }

        if (PROCESS_ENV_PATTERN.test(line)) {
          violations.push({
            filePath: file.relativePath,
            ruleName: 'no-raw-env-access',
            message: `禁止直接访问 process.env，应通过 boundary/env.schema.ts 解析后的配置对象获取`,
            fixHint: '将 process.env.XXX 替换为从 Env 配置对象中读取，配置通过依赖注入传入',
            docLink: 'docs/design-docs/golden-principles.md#禁止直接访问环境变量',
            line: i + 1,
          });
        }
      }
    }

    return violations;
  },
};

// ============================================================
// 规则 4: no-raw-request-access
// ============================================================

/**
 * 禁止在 service 层直接访问请求对象规则
 *
 * 检测 req.body、req.query、req.params 的使用。
 * 仅检查 service/ 目录下的文件。
 * 允许在 runtime/ 层文件中使用（边界解析发生在此处）。
 *
 * @see Requirements 8.7, 9.2
 */
export const noRawRequestAccessRule: LintRule = {
  name: 'no-raw-request-access',
  description: '禁止在 service 层直接访问 req.body/query/params，请求解析应在 runtime 层完成',

  check(context: LintContext): LintViolation[] {
    const violations: LintViolation[] = [];

    for (const file of context.files) {
      // 仅检查需要校验的区域
      if (!shouldCheckRequestAccess(file.relativePath)) {
        continue;
      }

      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 跳过注释行
        if (isCommentLine(line)) {
          continue;
        }

        for (const pattern of RAW_REQUEST_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              filePath: file.relativePath,
              ruleName: 'no-raw-request-access',
              message: `禁止在 service 层直接访问请求对象属性，应由 runtime 层解析后传入强类型参数`,
              fixHint: '将 req.body/query/params 的解析移到 runtime 层，service 层仅接收已解析的强类型参数',
              docLink: 'docs/design-docs/golden-principles.md#禁止直接访问请求对象',
              line: i + 1,
            });
            break; // 每行只报告一次
          }
        }
      }
    }

    return violations;
  },
};
