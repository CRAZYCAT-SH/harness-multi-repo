/**
 * sql.js 最小类型声明
 *
 * sql.js 是基于 WebAssembly 的 SQLite 实现，无需 C++ 编译工具链。
 * 此声明文件仅覆盖本项目使用到的 API 子集。
 */
declare module 'sql.js' {
  /** sql.js 初始化配置 */
  interface SqlJsConfig {
    /** 自定义 WASM 文件定位函数 */
    locateFile?: (filename: string) => string;
  }

  /** SQL 查询执行结果 */
  interface QueryExecResult {
    /** 列名数组 */
    columns: string[];
    /** 行数据，每行为一个值数组 */
    values: SqlValue[][];
  }

  /** SQL 绑定参数类型 */
  type BindParams = SqlValue[] | Record<string, SqlValue>;

  /** SQL 值类型 */
  type SqlValue = number | string | Uint8Array | null;

  /** SQLite 数据库实例 */
  interface Database {
    /**
     * 执行 SQL 语句并返回结果集
     * @param sql - SQL 语句
     * @param params - 绑定参数
     * @returns 查询结果数组（每条语句一个结果）
     */
    exec(sql: string, params?: BindParams): QueryExecResult[];

    /**
     * 执行 SQL 语句（无返回结果）
     * @param sql - SQL 语句
     * @param params - 绑定参数
     */
    run(sql: string, params?: BindParams): void;

    /**
     * 获取最近一次 INSERT/UPDATE/DELETE 影响的行数
     */
    getRowsModified(): number;

    /**
     * 将数据库导出为二进制数据
     * @returns 数据库文件的 Uint8Array 表示
     */
    export(): Uint8Array;

    /**
     * 关闭数据库连接并释放资源
     */
    close(): void;
  }

  /** sql.js 模块接口 */
  interface SqlJsStatic {
    /** 创建新的数据库实例 */
    Database: {
      /** 创建空数据库 */
      new (): Database;
      /** 从二进制数据加载数据库 */
      new (data: ArrayLike<number> | Buffer | null): Database;
    };
  }

  /**
   * 初始化 sql.js 模块（加载 WASM）
   * @param config - 可选配置
   * @returns sql.js 模块实例
   */
  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
