/**
 * 认证提供者实现
 *
 * 基于 bcryptjs 实现密码哈希与验证，基于 jsonwebtoken 实现 JWT 签发与验证。
 * 通过工厂函数接收 jwtSecret 和 jwtExpiresIn 参数，确保配置可注入、可测试。
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { AuthProvider, TokenPayload } from './index.js';

/**
 * 创建认证提供者实例
 *
 * @param jwtSecret - JWT 签名密钥（建议长度 ≥ 32 字符）
 * @param jwtExpiresIn - JWT 有效期（如 '24h'、'7d'）
 * @returns AuthProvider 接口实现
 */
export function createAuthProvider(jwtSecret: string, jwtExpiresIn: string): AuthProvider {
  return {
    /**
     * 对明文密码进行 bcrypt 哈希
     *
     * 使用 cost factor 10（满足 Requirement 15.2 中 cost ≥ 10 的要求）。
     *
     * @param password - 明文密码
     * @returns 哈希后的密码字符串
     */
    async hashPassword(password: string): Promise<string> {
      return bcrypt.hash(password, 10);
    },

    /**
     * 验证明文密码与存储的哈希是否匹配
     *
     * @param password - 明文密码
     * @param hash - 存储的 bcrypt 哈希值
     * @returns 是否匹配
     */
    async verifyPassword(password: string, hash: string): Promise<boolean> {
      return bcrypt.compare(password, hash);
    },

    /**
     * 签发 JWT Token
     *
     * 将 payload 中的 user_id 和 email 编码到 JWT 中，
     * 过期时间由 jwt.sign 的 expiresIn 选项控制（忽略 payload 中的 exp 字段）。
     *
     * @param payload - Token 载荷（含 user_id、email）
     * @returns 签名后的 JWT 字符串
     */
    signToken(payload: TokenPayload): string {
      const { exp, ...rest } = payload;
      const options: jwt.SignOptions = { expiresIn: jwtExpiresIn as unknown as jwt.SignOptions['expiresIn'] };
      return jwt.sign(rest, jwtSecret, options);
    },

    /**
     * 验证 JWT Token 的签名与有效期
     *
     * 验证失败（签名无效、已过期等）时返回 null，不抛出异常。
     *
     * @param token - JWT 字符串
     * @returns 解码后的载荷，验证失败时返回 null
     */
    verifyToken(token: string): TokenPayload | null {
      try {
        const decoded = jwt.verify(token, jwtSecret) as TokenPayload;
        return decoded;
      } catch {
        return null;
      }
    },
  };
}
