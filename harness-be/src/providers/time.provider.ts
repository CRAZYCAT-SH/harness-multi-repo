/**
 * 时间提供者实现
 *
 * 封装当前时间获取逻辑。
 * 生产环境返回真实系统时间，测试时可替换为固定时间实现，
 * 确保业务逻辑中的时间依赖可控、可测试。
 */

import type { TimeProvider } from './index.js';

/**
 * 创建时间提供者实例
 *
 * @returns TimeProvider 实例，now() 返回当前系统时间
 */
export function createTimeProvider(): TimeProvider {
  return {
    /** 获取当前时间 */
    now(): Date {
      return new Date();
    },
  };
}
