/**
 * Providers 接口定义
 *
 * 横切关注点的统一接口层。所有外部依赖（数据库、认证、日志、遥测、时间、随机数）
 * 通过此接口注入到业务域中，确保业务逻辑与具体实现解耦。
 */

// ============================================================
// 辅助类型（占位，待 auth 域类型实现后替换为正式导入）
// ============================================================

/** JWT Token 载荷类型（占位定义，后续由 auth 域提供） */
export interface TokenPayload {
  /** 用户唯一标识 */
  user_id: string;
  /** 用户邮箱 */
  email: string;
  /** 过期时间（Unix 时间戳，秒） */
  exp: number;
}

/** OpenTelemetry Span 最小接口（避免强依赖 @opentelemetry/api） */
export interface Span {
  /** 设置 span 属性 */
  setAttribute(key: string, value: string | number | boolean): void;
  /** 记录异常信息 */
  recordException(error: Error): void;
  /** 结束当前 span */
  end(): void;
}

// ============================================================
// Provider 接口定义
// ============================================================

/**
 * 数据库访问提供者
 *
 * 基于 sql.js 实现，所有方法为同步调用。
 * 封装 SQL 查询、单条查询、执行（INSERT/UPDATE/DELETE）三种操作。
 */
export interface DatabaseProvider {
  /**
   * 执行查询并返回多条结果
   * @param sql - SQL 查询语句
   * @param params - 绑定参数
   * @returns 查询结果数组
   */
  query<T>(sql: string, params?: unknown[]): T[];

  /**
   * 执行查询并返回单条结果（无结果时返回 null）
   * @param sql - SQL 查询语句
   * @param params - 绑定参数
   * @returns 单条结果或 null
   */
  queryOne<T>(sql: string, params?: unknown[]): T | null;

  /**
   * 执行写操作（INSERT/UPDATE/DELETE）
   * @param sql - SQL 语句
   * @param params - 绑定参数
   * @returns 受影响的行数
   */
  execute(sql: string, params?: unknown[]): { changes: number };
}

/**
 * 认证提供者
 *
 * 封装密码哈希、密码验证、JWT 签发与验证等认证相关操作。
 */
export interface AuthProvider {
  /**
   * 对明文密码进行 bcrypt 哈希
   * @param password - 明文密码
   * @returns 哈希后的密码字符串
   */
  hashPassword(password: string): Promise<string>;

  /**
   * 验证明文密码与哈希是否匹配
   * @param password - 明文密码
   * @param hash - 存储的哈希值
   * @returns 是否匹配
   */
  verifyPassword(password: string, hash: string): Promise<boolean>;

  /**
   * 签发 JWT Token
   * @param payload - Token 载荷
   * @returns 签名后的 JWT 字符串
   */
  signToken(payload: TokenPayload): string;

  /**
   * 验证 JWT Token 的签名与有效期
   * @param token - JWT 字符串
   * @returns 解码后的载荷，验证失败时返回 null
   */
  verifyToken(token: string): TokenPayload | null;
}

/**
 * 日志提供者
 *
 * 提供结构化日志输出，集成 OpenTelemetry 上下文。
 * 业务代码禁止直接使用 console.*，必须通过此接口记录日志。
 */
export interface LoggerProvider {
  /**
   * 记录信息级别日志
   * @param message - 日志消息
   * @param context - 附加上下文字段
   */
  info(message: string, context?: Record<string, unknown>): void;

  /**
   * 记录警告级别日志
   * @param message - 日志消息
   * @param context - 附加上下文字段
   */
  warn(message: string, context?: Record<string, unknown>): void;

  /**
   * 记录错误级别日志
   * @param message - 日志消息
   * @param context - 附加上下文字段
   */
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * 遥测提供者
 *
 * 封装 OpenTelemetry 的 Span 创建与指标记录。
 * 用于业务操作的追踪与性能指标采集。
 */
export interface TelemetryProvider {
  /**
   * 创建并启动一个新的追踪 Span
   * @param name - Span 名称，遵循 service.domain.operation 命名约定
   * @param attributes - 初始属性键值对
   * @returns 活跃的 Span 实例
   */
  startSpan(name: string, attributes?: Record<string, string>): Span;

  /**
   * 记录一个指标数据点
   * @param name - 指标名称
   * @param value - 指标值
   * @param labels - 指标标签
   */
  recordMetric(name: string, value: number, labels?: Record<string, string>): void;
}

/**
 * 时间提供者
 *
 * 封装当前时间获取，便于测试时注入固定时间。
 */
export interface TimeProvider {
  /** 获取当前时间 */
  now(): Date;
}

/**
 * 随机数提供者
 *
 * 封装 UUID 生成，便于测试时注入确定性值。
 */
export interface RandomProvider {
  /** 生成一个 UUID v4 */
  uuid(): string;
}

// ============================================================
// 聚合接口
// ============================================================

/**
 * Providers 聚合接口
 *
 * 将所有横切关注点的提供者统一为一个接口，
 * 通过依赖注入传递给各业务域的 Service 和 Repo 层。
 */
export interface Providers {
  /** 数据库访问 */
  db: DatabaseProvider;
  /** 认证（密码哈希、JWT） */
  auth: AuthProvider;
  /** 结构化日志 */
  logger: LoggerProvider;
  /** 遥测（追踪与指标） */
  telemetry: TelemetryProvider;
  /** 时间源 */
  time: TimeProvider;
  /** 随机数源 */
  random: RandomProvider;
}
