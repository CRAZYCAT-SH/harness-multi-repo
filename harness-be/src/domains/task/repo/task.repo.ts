/**
 * Task 域 Repository 层
 *
 * 负责任务实体的数据库持久化操作，包括创建、分页查询、单条查询、更新和删除。
 * 所有数据库返回值经 TaskRowSchema（Zod）解析，确保类型安全。
 * 通过依赖注入接收 DatabaseProvider，不直接依赖具体数据库实现。
 */

import type { DatabaseProvider } from '../../../providers/index.js';
import type { Task, TaskQuery, PaginatedTasks } from '../types/index.js';
import { TaskRowSchema } from '../types/index.js';

// ============================================================
// Repository 接口定义
// ============================================================

/**
 * Task Repository 接口
 *
 * 定义任务实体的所有数据访问方法。
 */
export interface TaskRepo {
  /**
   * 创建新任务
   * @param task - 任务创建数据
   * @returns 创建后的完整任务实体
   */
  create(task: {
    id: string;
    owner_id: string;
    title: string;
    description?: string;
    priority: string;
    due_date?: string | null;
    parent_id?: string | null;
  }): Task;

  /**
   * 按所有者分页查询任务列表
   * @param ownerId - 所有者用户 ID
   * @param query - 分页、过滤、搜索参数
   * @returns 分页任务列表（含总数、页码、每页条数）
   */
  findByOwner(ownerId: string, query: TaskQuery): PaginatedTasks;

  /**
   * 按父任务 ID 查询子任务列表
   * @param parentId - 父任务 ID
   * @returns 子任务列表
   */
  findByParentId(parentId: string): Task[];

  /**
   * 按 ID 查询单条任务
   * @param id - 任务 ID
   * @returns 任务实体，不存在时返回 null
   */
  findById(id: string): Task | null;

  /**
   * 更新任务字段
   * @param id - 任务 ID
   * @param data - 需要更新的字段键值对
   * @returns 更新后的任务实体，不存在时返回 null
   */
  update(id: string, data: Record<string, unknown>): Task | null;

  /**
   * 删除任务
   * @param id - 任务 ID
   * @returns 是否成功删除（true 表示删除了一条记录）
   */
  delete(id: string): boolean;
}

// ============================================================
// Repository 工厂函数
// ============================================================

/**
 * 创建 Task Repository 实例
 *
 * 通过依赖注入接收 DatabaseProvider，返回实现 TaskRepo 接口的对象。
 * 所有查询使用参数化 SQL 防止注入，所有结果经 Zod 解析确保类型安全。
 *
 * @param db - 数据库访问提供者
 * @returns TaskRepo 实例
 */
export function createTaskRepo(db: DatabaseProvider): TaskRepo {
  return {
    /**
     * 插入新任务记录到数据库
     */
    create(task) {
      const {
        id,
        owner_id,
        title,
        description,
        priority,
        due_date,
        parent_id,
      } = task;

      db.execute(
        `INSERT INTO tasks (id, owner_id, title, description, priority, due_date, parent_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, owner_id, title, description ?? null, priority, due_date ?? null, parent_id ?? null]
      );

      // 查询刚插入的记录（含数据库生成的 created_at、updated_at 默认值）
      const row = db.queryOne<Record<string, unknown>>(
        'SELECT * FROM tasks WHERE id = ?',
        [id]
      );

      return TaskRowSchema.parse(row);
    },

    /**
     * 按所有者分页查询任务，支持状态/优先级过滤和关键词搜索
     *
     * 搜索使用 LIKE 模式匹配 title 和 description 字段（大小写不敏感）。
     * 返回结果包含分页元数据（total、page、page_size）。
     */
    findByOwner(ownerId, query) {
      const { page, page_size, status, priority, search } = query;

      // 构建 WHERE 条件与参数
      const conditions: string[] = ['owner_id = ?'];
      const params: unknown[] = [ownerId];

      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }

      if (priority) {
        conditions.push('priority = ?');
        params.push(priority);
      }

      if (search) {
        conditions.push('(title LIKE ? OR description LIKE ?)');
        const pattern = `%${search}%`;
        params.push(pattern, pattern);
      }

      const whereClause = conditions.join(' AND ');

      // 查询符合条件的总数
      const countRow = db.queryOne<{ total: number }>(
        `SELECT COUNT(*) as total FROM tasks WHERE ${whereClause}`,
        params
      );
      const total = countRow?.total ?? 0;

      // 分页查询数据
      const offset = (page - 1) * page_size;
      const dataParams = [...params, page_size, offset];

      const rows = db.query<Record<string, unknown>>(
        `SELECT * FROM tasks WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        dataParams
      );

      // 对每条记录应用 Zod 解析
      const items = rows.map((row) => TaskRowSchema.parse(row));

      return {
        items,
        total,
        page,
        page_size,
      };
    },

    /**
     * 按 ID 查询单条任务记录
     */
    findById(id) {
      const row = db.queryOne<Record<string, unknown>>(
        'SELECT * FROM tasks WHERE id = ?',
        [id]
      );

      if (!row) {
        return null;
      }

      return TaskRowSchema.parse(row);
    },

    /**
     * 按父任务 ID 查询子任务列表
     */
    findByParentId(parentId) {
      const rows = db.query<Record<string, unknown>>(
        'SELECT * FROM tasks WHERE parent_id = ? ORDER BY created_at ASC',
        [parentId]
      );

      return rows.map((row) => TaskRowSchema.parse(row));
    },

    /**
     * 动态更新任务字段
     *
     * 根据传入的 data 对象动态构建 SET 子句，
     * 同时自动更新 updated_at 字段为当前时间。
     */
    update(id, data) {
      // 过滤掉 undefined 值，保留 null（用于清除字段）
      const entries = Object.entries(data).filter(
        ([, value]) => value !== undefined
      );

      if (entries.length === 0) {
        // 无需更新，直接返回当前记录
        return this.findById(id);
      }

      // 构建 SET 子句
      const setClauses = entries.map(([key]) => `${key} = ?`);
      setClauses.push("updated_at = datetime('now')");

      const values = entries.map(([, value]) => value);
      values.push(id);

      const sql = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`;
      const { changes } = db.execute(sql, values);

      if (changes === 0) {
        return null;
      }

      return this.findById(id);
    },

    /**
     * 按 ID 删除任务记录
     */
    delete(id) {
      const { changes } = db.execute(
        'DELETE FROM tasks WHERE id = ?',
        [id]
      );

      return changes > 0;
    },
  };
}
