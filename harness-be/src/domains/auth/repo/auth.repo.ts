/**
 * Auth 域 Repository 层
 *
 * 负责用户数据的持久化访问。所有数据库查询结果均通过 Zod Schema 解析，
 * 确保返回值类型安全，遵循 "Parse, don't validate" 原则。
 *
 * 依赖方向：types → config → repo（本层）→ service → runtime
 * 横切关注点通过 DatabaseProvider 依赖注入获取。
 */

import type { DatabaseProvider } from '../../../providers/index.js';
import type { User } from '../types/index.js';
import { UserRowSchema } from '../types/index.js';

/**
 * Auth 仓储接口
 *
 * 定义认证域数据访问层的公开方法契约。
 */
export interface AuthRepo {
  /**
   * 根据邮箱查找用户
   * @param email - 用户邮箱
   * @returns 匹配的用户实体，未找到时返回 null
   */
  findByEmail(email: string): User | null;

  /**
   * 创建新用户记录
   * @param id - 用户唯一标识（UUID）
   * @param email - 用户邮箱
   * @param passwordHash - bcrypt 哈希后的密码
   * @returns 新创建的用户实体
   */
  create(id: string, email: string, passwordHash: string): User;
}

/**
 * 创建 Auth 仓储实例
 *
 * 工厂函数，接收 DatabaseProvider 依赖注入，返回实现 AuthRepo 接口的对象。
 * 所有数据库返回值均经 UserRowSchema（Zod）解析，确保类型安全。
 *
 * @param db - 数据库访问提供者
 * @returns AuthRepo 实例
 */
export function createAuthRepo(db: DatabaseProvider): AuthRepo {
  return {
    /**
     * 根据邮箱查找用户
     *
     * 执行 SQL 查询并对结果应用 Zod 解析。
     * 若无匹配记录则返回 null。
     *
     * @param email - 用户邮箱
     * @returns 解析后的用户实体或 null
     */
    findByEmail(email: string): User | null {
      const row = db.queryOne<unknown>('SELECT * FROM users WHERE email = ?', [email]);
      if (!row) return null;
      return UserRowSchema.parse(row);
    },

    /**
     * 创建新用户记录
     *
     * 向 users 表插入一条新记录，随后查询并返回完整的用户实体。
     * 插入与查询结果均经 Zod 解析确保数据完整性。
     *
     * @param id - 用户唯一标识（UUID）
     * @param email - 用户邮箱
     * @param passwordHash - bcrypt 哈希后的密码
     * @returns 新创建的用户实体（含数据库生成的 created_at）
     */
    create(id: string, email: string, passwordHash: string): User {
      db.execute(
        'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
        [id, email, passwordHash]
      );
      const row = db.queryOne<unknown>('SELECT * FROM users WHERE id = ?', [id]);
      return UserRowSchema.parse(row);
    },
  };
}
