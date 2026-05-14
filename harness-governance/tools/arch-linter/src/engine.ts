/**
 * Architecture Linter 规则执行引擎
 *
 * 负责注册规则并依次执行，收集所有违规报告。
 */

import type { LintRule, LintContext, LintViolation } from './types.js';

/**
 * Lint 引擎
 *
 * 管理规则注册与批量执行，将所有规则的违规结果汇总返回。
 */
export class LintEngine {
  /** 已注册的规则列表 */
  private rules: LintRule[] = [];

  /**
   * 注册一条 Lint 规则
   * @param rule - 实现了 LintRule 接口的规则实例
   */
  registerRule(rule: LintRule): void {
    this.rules.push(rule);
  }

  /**
   * 执行所有已注册规则的检查
   * @param context - Lint 执行上下文
   * @returns 所有规则产生的违规列表
   */
  run(context: LintContext): LintViolation[] {
    const violations: LintViolation[] = [];
    for (const rule of this.rules) {
      violations.push(...rule.check(context));
    }
    return violations;
  }
}
