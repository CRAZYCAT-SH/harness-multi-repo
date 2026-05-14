/**
 * Task 域 Service 层
 *
 * 负责任务管理的核心业务逻辑，包括创建、列表查询、更新和删除。
 * 通过依赖注入接收 TaskRepo 和 Providers，确保业务逻辑与基础设施解耦。
 *
 * 安全策略：
 * - 所有操作均校验 ownerId，确保用户只能操作自己的任务
 * - 资源不存在与无权访问返回相同的 404 错误，防止信息泄露
 * - 创建任务时校验截止日期不能为过去时间
 */

import type { Providers } from '../../../providers/index.js';
import type { TaskRepo } from '../repo/task.repo.js';
import type { CreateTaskInput, UpdateTaskInput, TaskQuery, Task, PaginatedTasks } from '../types/index.js';
import { NotFoundError, AppError } from '../../shared/types/errors.js';

// ============================================================
// Service 接口定义
// ============================================================

/**
 * Task Service 接口
 *
 * 定义任务管理的所有业务操作方法。
 */
export interface TaskService {
  /**
   * 创建新任务
   * @param ownerId - 任务所有者用户 ID
   * @param data - 创建任务的输入数据
   * @returns 创建后的完整任务实体
   * @throws AppError DUE_DATE_IN_PAST 当截止日期早于当前时间
   */
  create(ownerId: string, data: CreateTaskInput): Task;

  /**
   * 分页查询当前用户的任务列表
   * @param ownerId - 任务所有者用户 ID
   * @param query - 分页、过滤、搜索参数
   * @returns 分页任务列表
   */
  list(ownerId: string, query: TaskQuery): PaginatedTasks;

  /**
   * 获取指定任务的子任务列表
   * @param ownerId - 当前操作用户 ID
   * @param taskId - 父任务 ID
   * @returns 子任务列表
   */
  getSubtasks(ownerId: string, taskId: string): Task[];

  /**
   * 更新指定任务
   * @param ownerId - 当前操作用户 ID
   * @param taskId - 目标任务 ID
   * @param data - 需要更新的字段
   * @returns 更新后的完整任务实体
   * @throws NotFoundError 当任务不存在或不属于当前用户
   */
  update(ownerId: string, taskId: string, data: UpdateTaskInput): Task;

  /**
   * 删除指定任务
   * @param ownerId - 当前操作用户 ID
   * @param taskId - 目标任务 ID
   * @throws NotFoundError 当任务不存在或不属于当前用户
   */
  delete(ownerId: string, taskId: string): void;
}

// ============================================================
// Service 工厂函数
// ============================================================

/**
 * 创建 Task Service 实例
 *
 * 通过依赖注入接收 TaskRepo 和 Providers，返回实现 TaskService 接口的对象。
 * 使用 providers.time 获取当前时间（便于测试注入固定时间），
 * 使用 providers.random 生成任务 ID（便于测试注入确定性值）。
 *
 * @param repo - Task Repository 实例
 * @param providers - 横切关注点提供者集合
 * @returns TaskService 实例
 */
export function createTaskService(repo: TaskRepo, providers: Providers): TaskService {
  return {
    /**
     * 创建新任务
     *
     * 业务规则：
     * 1. 若提供了 due_date，校验其不早于当前时间
     * 2. 通过 providers.random.uuid() 生成任务 ID
     * 3. priority 默认为 'normal'
     */
    create(ownerId, data) {
      // 校验截止日期不能为过去时间
      if (data.due_date) {
        const dueDate = new Date(data.due_date);
        const now = providers.time.now();
        if (dueDate < now) {
          throw new AppError('DUE_DATE_IN_PAST', 400, '截止日期不能早于当前时间');
        }
      }

      // 校验父任务存在性与所有权
      if (data.parent_id) {
        const parent = repo.findById(data.parent_id);
        if (!parent || parent.owner_id !== ownerId) {
          throw new AppError('PARENT_TASK_NOT_FOUND', 400, '父任务不存在或无权访问');
        }
      }

      const id = providers.random.uuid();
      return repo.create({
        id,
        owner_id: ownerId,
        title: data.title,
        description: data.description,
        priority: data.priority ?? 'normal',
        due_date: data.due_date ?? null,
        parent_id: data.parent_id ?? null,
      });
    },

    /**
     * 分页查询当前用户的任务列表
     *
     * 始终以 ownerId 作为过滤条件，确保用户只能查看自己的任务。
     * 查询参数（分页、状态过滤、优先级过滤、搜索）委托给 Repo 层处理。
     */
    list(ownerId, query) {
      return repo.findByOwner(ownerId, query);
    },

    /**
     * 获取指定任务的子任务列表
     *
     * 校验父任务存在性与所有权后，返回其所有子任务。
     */
    getSubtasks(ownerId, taskId) {
      const task = repo.findById(taskId);
      if (!task || task.owner_id !== ownerId) {
        throw new NotFoundError('task');
      }
      return repo.findByParentId(taskId);
    },

    /**
     * 更新指定任务
     *
     * 安全策略：先校验任务存在性与所有权，再执行更新。
     * 无论任务不存在还是不属于当前用户，均返回相同的 404 错误，
     * 防止攻击者通过错误码探测其他用户的任务 ID。
     */
    update(ownerId, taskId, data) {
      // 校验任务存在性与所有权（统一返回 404，不泄露存在性）
      const task = repo.findById(taskId);
      if (!task || task.owner_id !== ownerId) {
        throw new NotFoundError('task');
      }

      // 校验父任务存在性与所有权（如果要设置 parent_id）
      if (data.parent_id) {
        // 不允许将自己设为父任务
        if (data.parent_id === taskId) {
          throw new AppError('INVALID_PARENT', 400, '不能将任务设为自己的子任务');
        }
        const parent = repo.findById(data.parent_id);
        if (!parent || parent.owner_id !== ownerId) {
          throw new AppError('PARENT_TASK_NOT_FOUND', 400, '父任务不存在或无权访问');
        }
      }

      const updated = repo.update(taskId, data as Record<string, unknown>);
      if (!updated) {
        throw new NotFoundError('task');
      }
      return updated;
    },

    /**
     * 删除指定任务
     *
     * 安全策略：先校验任务存在性与所有权，再执行删除。
     * 无论任务不存在还是不属于当前用户，均返回相同的 404 错误。
     */
    delete(ownerId, taskId) {
      // 校验任务存在性与所有权（统一返回 404，不泄露存在性）
      const task = repo.findById(taskId);
      if (!task || task.owner_id !== ownerId) {
        throw new NotFoundError('task');
      }

      repo.delete(taskId);
    },
  };
}
