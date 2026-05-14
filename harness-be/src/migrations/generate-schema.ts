/**
 * 数据库 Schema 生成脚本
 *
 * 职责：
 * - 读取当前 SQLite 数据库的 schema 信息
 * - 查询 sqlite_master 获取所有表和索引的定义
 * - 输出 Markdown 格式的 schema 文档到 docs/generated/db-schema.md
 *
 * 使用方式：pnpm db:schema:generate
 * 对应命令：node backend/dist/migrations/generate-schema.js
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createDatabaseProvider } from '../providers/db.provider.js';

/** sqlite_master 表中的记录类型 */
interface SqliteMasterRow {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
}

/**
 * 生成数据库 schema 文档
 *
 * 连接到指定的 SQLite 数据库，提取所有表和索引的 CREATE 语句，
 * 格式化为 Markdown 文档并写入 docs/generated/db-schema.md。
 */
async function generateSchema(): Promise<void> {
  // 从环境变量获取数据库路径，默认使用开发数据库
  const databaseUrl = process.env.DATABASE_URL || join(process.cwd(), 'data', 'app.db');

  // 检查数据库文件是否存在
  if (!existsSync(databaseUrl) && databaseUrl !== ':memory:') {
    console.error(`[schema-generate] 数据库文件不存在: ${databaseUrl}`);
    console.error('[schema-generate] 请先启动应用以创建数据库，或指定 DATABASE_URL 环境变量');
    process.exit(1);
  }

  // 创建数据库连接
  const db = await createDatabaseProvider(databaseUrl);

  // 查询所有用户创建的表和索引（排除内部表和迁移跟踪表）
  const objects = db.query<SqliteMasterRow>(
    `SELECT type, name, tbl_name, sql FROM sqlite_master
     WHERE type IN ('table', 'index')
       AND name NOT LIKE 'sqlite_%'
       AND name != '_migrations'
     ORDER BY type DESC, name ASC`
  );

  // 分离表和索引
  const tables = objects.filter(obj => obj.type === 'table');
  const indexes = objects.filter(obj => obj.type === 'index' && obj.sql !== null);

  // 生成 Markdown 内容
  const now = new Date().toISOString().split('T')[0];
  let markdown = `# 数据库 Schema\n\n`;
  markdown += `> 自动生成于 ${now}，请勿手动编辑。\n`;
  markdown += `> 使用 \`pnpm db:schema:generate\` 重新生成。\n\n`;

  // 输出表定义
  markdown += `## 表结构\n\n`;
  for (const table of tables) {
    markdown += `### ${table.name}\n\n`;
    markdown += `\`\`\`sql\n${table.sql};\n\`\`\`\n\n`;

    // 输出该表关联的索引
    const tableIndexes = indexes.filter(idx => idx.tbl_name === table.name);
    if (tableIndexes.length > 0) {
      markdown += `**索引：**\n\n`;
      markdown += `\`\`\`sql\n`;
      for (const idx of tableIndexes) {
        markdown += `${idx.sql};\n`;
      }
      markdown += `\`\`\`\n\n`;
    }
  }

  // 输出统计信息
  markdown += `---\n\n`;
  markdown += `## 统计\n\n`;
  markdown += `| 类型 | 数量 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| 表 | ${tables.length} |\n`;
  markdown += `| 索引 | ${indexes.length} |\n`;

  // 确保输出目录存在
  const outputPath = join(process.cwd(), 'docs', 'generated', 'db-schema.md');
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // 写入文件
  writeFileSync(outputPath, markdown, 'utf-8');
  console.log(`[schema-generate] Schema 文档已生成: ${outputPath}`);
  console.log(`[schema-generate] 共 ${tables.length} 张表，${indexes.length} 个索引`);
}

// 执行主函数
generateSchema().catch((err) => {
  console.error('[schema-generate] 生成失败:', err);
  process.exit(1);
});
