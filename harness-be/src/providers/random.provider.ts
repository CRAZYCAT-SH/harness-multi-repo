/**
 * 随机数提供者实现
 *
 * 封装 UUID v4 生成逻辑。
 * 生产环境使用 uuid 库生成真随机 ID，测试时可替换为确定性实现，
 * 确保涉及 ID 生成的业务逻辑可重复验证。
 */

import { v4 as uuidv4 } from 'uuid';
import type { RandomProvider } from './index.js';

/**
 * 创建随机数提供者实例
 *
 * @returns RandomProvider 实例，uuid() 返回 UUID v4 字符串
 */
export function createRandomProvider(): RandomProvider {
  return {
    /** 生成一个 UUID v4 */
    uuid(): string {
      return uuidv4();
    },
  };
}
