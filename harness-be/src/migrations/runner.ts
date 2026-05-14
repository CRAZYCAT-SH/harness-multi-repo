/**
 * 数据库迁移运行器
 *
 * 职责：
 * - 从 backend/migrations/ 目录读取 SQL 迁移文件
 * - 通过 _migrations 表跟踪已应用的迁移
 * - 启动时按顺序执行所有未应用的迁移
 * - 迁移文件命名规则：{number}_{slug}.sql（如 001_initial.sql）
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseProvider } from '../providers/index.js';

/**
 * 执行数据库迁移
 *
 * 读取指定目录下的 .sql 迁移文件，按文件名排序后依次执行未应用的迁移。
 * 每次成功执行后将迁移名称记录到 _migrations 表中，确保幂等性。
 *
 * @param db - 数据库提供者实例
 * @param migrationsDir - 迁移文件所在目录的绝对路径
 *
 * @example
 * ```typescript
 * import { runMigrations } from './migrations/runner.js';
 * import { join } from 'node:path';
 *
 * // 在应用启动时执行迁移
 * runMigrations(db, join(__dirname, '../../migrations'));
 * ```
 */
export function runMigrations(db: DatabaseProvider, migrationsDir: string): void {
  // 创建迁移跟踪表（如果不存在）
  db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 获取已应用的迁移列表
  const applied = db.query<{ name: string }>('SELECT name FROM _migrations ORDER BY id');
  const appliedNames = new Set(applied.map(m => m.name));

  // 读取迁移目录中的 .sql 文件并按文件名排序
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // 依次执行未应用的迁移
  for (const file of files) {
    if (appliedNames.has(file)) continue;

    const sql = readFileSync(join(migrationsDir, file), 'utf-8');

    // 按分号拆分为多条语句并逐条执行
    const statements = sql.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        db.execute(stmt);
      }
    }

    // 记录迁移已应用
    db.execute('INSERT INTO _migrations (name) VALUES (?)', [file]);
  }
}
