/**
 * Architecture Linter 核心类型定义
 *
 * 定义 Lint 规则、违规报告、执行上下文等核心接口。
 */

/**
 * Lint 规则接口
 *
 * 每条架构不变式规则都实现此接口，提供名称、描述和检查逻辑。
 */
export interface LintRule {
  /** 规则唯一标识名称，如 "no-reverse-dependency" */
  name: string;
  /** 规则描述，说明该规则校验的内容 */
  description: string;
  /**
   * 执行规则检查
   * @param context - 当前 Lint 执行上下文（包含所有待检查文件）
   * @returns 违规列表，无违规时返回空数组
   */
  check(context: LintContext): LintViolation[];
}

/**
 * Lint 违规报告
 *
 * 每条违规包含文件路径、规则名、错误信息、修复指引和文档链接。
 */
export interface LintViolation {
  /** 违规文件的相对路径 */
  filePath: string;
  /** 触发违规的规则名称 */
  ruleName: string;
  /** 违规描述信息 */
  message: string;
  /** 修复指引，告诉开发者如何修复该违规 */
  fixHint: string;
  /** 相关文档链接，指向详细说明 */
  docLink: string;
  /** 违规所在行号（可选） */
  line?: number;
}

/**
 * Lint 执行上下文
 *
 * 包含待检查的源文件列表和项目根目录路径。
 */
export interface LintContext {
  /** 待检查的源文件列表 */
  files: SourceFile[];
  /** 项目根目录绝对路径 */
  projectRoot: string;
}

/**
 * 源文件信息
 *
 * 包含文件的绝对路径、内容和相对路径。
 */
export interface SourceFile {
  /** 文件绝对路径 */
  path: string;
  /** 文件内容（UTF-8 文本） */
  content: string;
  /** 相对于项目根目录的路径 */
  relativePath: string;
}
