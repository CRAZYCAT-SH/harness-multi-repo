/**
 * 数据库提供者实现
 *
 * 基于 sql.js（WebAssembly SQLite）实现 DatabaseProvider 接口。
 * sql.js 无需 C++ 编译工具链，初始化为异步（加载 WASM），
 * 初始化完成后所有查询操作为同步调用。
 *
 * 支持两种模式：
 * - 内存数据库（databaseUrl 为 ":memory:" 或空字符串）：适用于测试
 * - 文件数据库（databaseUrl 为文件路径）：适用于开发环境
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import initSqlJs, { type Database } from 'sql.js';
import type { DatabaseProvider } from './index.js';

/**
 * 将 sql.js 的 exec 结果（columns + values 格式）转换为对象数组
 *
 * @param columns - 列名数组
 * @param values - 行数据二维数组
 * @returns 对象数组，每个对象的键为列名
 */
function rowsToObjects<T>(columns: string[], values: unknown[][]): T[] {
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      obj[columns[i]!] = row[i] ?? null;
    }
    return obj as T;
  });
}

/**
 * 创建数据库提供者实例
 *
 * 异步工厂函数：初始化 sql.js WASM 模块，根据 databaseUrl 创建或加载数据库，
 * 返回实现 DatabaseProvider 接口的对象。
 *
 * @param databaseUrl - 数据库路径。":memory:" 或空字符串表示内存数据库，否则为文件路径
 * @returns DatabaseProvider 实例
 *
 * @example
 * ```typescript
 * // 内存数据库（测试用）
 * const db = await createDatabaseProvider(':memory:');
 *
 * // 文件数据库（开发用）
 * const db = await createDatabaseProvider('./data/app.db');
 * ```
 */
export async function createDatabaseProvider(databaseUrl: string): Promise<DatabaseProvider> {
  const SQL = await initSqlJs();

  let db: Database;
  const isMemory = !databaseUrl || databaseUrl === ':memory:';

  if (isMemory) {
    // 内存数据库：每次启动创建全新实例
    db = new SQL.Database();
  } else if (existsSync(databaseUrl)) {
    // 文件数据库：从已有文件加载
    const fileBuffer = readFileSync(databaseUrl);
    db = new SQL.Database(fileBuffer);
  } else {
    // 文件路径不存在：创建新数据库（后续通过 persist 写入文件）
    db = new SQL.Database();
  }

  // 启用 WAL 模式以提升并发性能（仅对文件数据库有意义）
  if (!isMemory) {
    db.run('PRAGMA journal_mode=WAL;');
  }

  // 启用外键约束
  db.run('PRAGMA foreign_keys=ON;');

  /**
   * 将当前数据库状态持久化到文件
   * 仅在文件数据库模式下执行实际写入
   */
  function persist(): void {
    if (!isMemory) {
      const data = db.export();
      writeFileSync(databaseUrl, Buffer.from(data));
    }
  }

  const provider: DatabaseProvider = {
    /**
     * 执行查询并返回多条结果
     *
     * @param sql - SQL 查询语句
     * @param params - 绑定参数数组
     * @returns 查询结果对象数组
     */
    query<T>(sql: string, params?: unknown[]): T[] {
      const results = db.exec(sql, params as (number | string | Uint8Array | null)[] | undefined);

      // exec 返回空数组表示无结果
      if (results.length === 0) {
        return [];
      }

      // 取第一条语句的结果（通常只有一条 SELECT）
      const result = results[0]!;
      return rowsToObjects<T>(result.columns, result.values);
    },

    /**
     * 执行查询并返回单条结果
     *
     * @param sql - SQL 查询语句
     * @param params - 绑定参数数组
     * @returns 单条结果对象，无结果时返回 null
     */
    queryOne<T>(sql: string, params?: unknown[]): T | null {
      const rows = provider.query<T>(sql, params);
      return rows[0] ?? null;
    },

    /**
     * 执行写操作（INSERT/UPDATE/DELETE）
     *
     * @param sql - SQL 语句
     * @param params - 绑定参数数组
     * @returns 包含受影响行数的对象
     */
    execute(sql: string, params?: unknown[]): { changes: number } {
      db.run(sql, params as (number | string | Uint8Array | null)[] | undefined);
      const changes = db.getRowsModified();

      // 写操作后持久化到文件（仅文件模式）
      persist();

      return { changes };
    },
  };

  return provider;
}
