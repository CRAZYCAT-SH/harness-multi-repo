/**
 * Auth 域 Service 层
 *
 * 负责认证相关的核心业务逻辑：用户注册、登录、Token 验证。
 * 通过依赖注入接收 AuthRepo 和 Providers，确保业务逻辑与具体实现解耦。
 *
 * 安全设计：
 * - 注册时使用 bcrypt（cost ≥ 10）对密码进行哈希
 * - 登录失败时统一返回 AuthenticationError，不区分邮箱不存在与密码错误
 * - Token 验证失败时返回 null，不抛出异常
 *
 * 依赖方向：types → config → repo → service（本层）→ runtime
 */

import type { Providers } from '../../../providers/index.js';
import type { AuthRepo } from '../repo/auth.repo.js';
import type { RegisterRequest, LoginRequest, AuthResponse, TokenPayload } from '../types/index.js';
import { ConflictError, AuthenticationError } from '../../shared/types/errors.js';

/**
 * Auth Service 接口
 *
 * 定义认证域业务逻辑层的公开方法契约。
 */
export interface AuthService {
  /**
   * 用户注册
   *
   * 校验邮箱唯一性，对密码进行 bcrypt 哈希后创建用户记录。
   *
   * @param data - 注册请求数据（email、password）
   * @returns 新创建用户的 id 和 email
   * @throws ConflictError 当邮箱已被注册时抛出 409
   */
  register(data: RegisterRequest): Promise<{ id: string; email: string }>;

  /**
   * 用户登录
   *
   * 验证用户凭证，成功后签发 JWT Token。
   * 无论邮箱不存在还是密码错误，均抛出相同的 AuthenticationError，
   * 防止通过错误信息枚举已注册邮箱。
   *
   * @param data - 登录请求数据（email、password）
   * @returns 包含 JWT token 和用户基本信息的认证响应
   * @throws AuthenticationError 当凭证无效时抛出 401
   */
  login(data: LoginRequest): Promise<AuthResponse>;

  /**
   * 验证 JWT Token
   *
   * 校验 Token 的签名与有效期，返回解码后的载荷。
   * 验证失败时返回 null，不抛出异常。
   *
   * @param token - JWT 字符串
   * @returns 解码后的 TokenPayload，无效/过期时返回 null
   */
  validateToken(token: string): TokenPayload | null;
}

/**
 * 创建 Auth Service 实例
 *
 * 工厂函数，接收 AuthRepo 和 Providers 依赖注入，
 * 返回实现 AuthService 接口的对象。
 *
 * @param repo - Auth 仓储实例，提供用户数据访问
 * @param providers - 横切关注点提供者（auth、random 等）
 * @returns AuthService 实例
 */
export function createAuthService(repo: AuthRepo, providers: Providers): AuthService {
  return {
    /**
     * 用户注册
     *
     * 流程：
     * 1. 检查邮箱是否已被注册
     * 2. 使用 bcrypt（cost ≥ 10）对密码进行哈希
     * 3. 生成 UUID 作为用户 ID
     * 4. 创建用户记录并返回基本信息
     */
    async register(data: RegisterRequest): Promise<{ id: string; email: string }> {
      // 检查邮箱是否已存在
      const existing = repo.findByEmail(data.email);
      if (existing) {
        throw new ConflictError('EMAIL_ALREADY_REGISTERED', '该邮箱已被注册');
      }

      // 对密码进行 bcrypt 哈希（cost ≥ 10）
      const passwordHash = await providers.auth.hashPassword(data.password);

      // 生成用户唯一标识
      const id = providers.random.uuid();

      // 创建用户记录
      const user = repo.create(id, data.email, passwordHash);

      return { id: user.id, email: user.email };
    },

    /**
     * 用户登录
     *
     * 流程：
     * 1. 根据邮箱查找用户（不存在则抛出 AuthenticationError）
     * 2. 验证密码哈希（不匹配则抛出 AuthenticationError）
     * 3. 签发 JWT Token 并返回认证响应
     *
     * 安全：邮箱不存在与密码错误返回相同错误，防止信息泄露
     */
    async login(data: LoginRequest): Promise<AuthResponse> {
      // 根据邮箱查找用户
      const user = repo.findByEmail(data.email);
      if (!user) {
        throw new AuthenticationError();
      }

      // 验证密码
      const valid = await providers.auth.verifyPassword(data.password, user.password_hash);
      if (!valid) {
        throw new AuthenticationError();
      }

      // 签发 JWT Token
      const token = providers.auth.signToken({
        user_id: user.id,
        email: user.email,
        exp: 0, // exp 由 jwt.sign 的 expiresIn 选项控制
      });

      return {
        token,
        user: { id: user.id, email: user.email },
      };
    },

    /**
     * 验证 JWT Token
     *
     * 委托给 AuthProvider 进行签名与有效期校验。
     * 验证失败时返回 null，不抛出异常，由调用方决定后续处理。
     */
    validateToken(token: string): TokenPayload | null {
      return providers.auth.verifyToken(token);
    },
  };
}
