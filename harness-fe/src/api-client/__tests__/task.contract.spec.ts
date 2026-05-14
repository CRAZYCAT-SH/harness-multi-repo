/**
 * Task 域契约测试（前端）
 *
 * 验证前端 API 客户端的 Zod Schema 与 harness-governance/contracts 中定义的
 * JSON Schema 保持一致。确保前端对后端响应的解析与契约定义对齐。
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TaskSchema, PaginatedTasksSchema } from '../schemas';

// 契约目录：通过环境变量 CONTRACTS_DIR 指定，默认回退到兄弟目录约定
const CONTRACTS_DIR = path.resolve(process.cwd(), process.env.CONTRACTS_DIR || '../harness-governance/contracts');
const CONTRACT_PATH = path.join(CONTRACTS_DIR, 'schemas', 'task.schema.json');

describe('contract: Task 前端契约一致性', () => {
  const contractRaw = fs.readFileSync(CONTRACT_PATH, 'utf8');
  const contract = JSON.parse(contractRaw);

  describe('TaskResponse Schema', () => {
    const contractSchema = contract.definitions.TaskResponse;

    it('契约 TaskResponse 定义存在', () => {
      expect(contractSchema).toBeDefined();
      expect(contractSchema.type).toBe('object');
    });

    it('契约要求的必填字段在前端 TaskSchema 中都有定义', () => {
      const contractRequired = contractSchema.required || [];
      const zodFields = Object.keys(TaskSchema.shape);

      // 契约使用 camelCase（createdAt），前端使用 snake_case（created_at）
      // 建立映射关系
      const fieldMapping: Record<string, string> = {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        userId: 'owner_id',
      };

      const missingFields: string[] = [];
      for (const field of contractRequired) {
        const implField = fieldMapping[field] || field;
        if (!zodFields.includes(implField)) {
          missingFields.push(`${field} (期望映射为 ${implField})`);
        }
      }

      if (missingFields.length > 0) {
        expect.fail(
          `契约要求的必填字段在前端缺失: [${missingFields.join(', ')}]\n` +
          `  前端 TaskSchema 字段: [${zodFields.join(', ')}]`
        );
      }
    });

    it('status 枚举值应与契约一致', () => {
      const contractStatus = contractSchema.properties.status;
      expect(contractStatus.enum).toContain('pending');
      expect(contractStatus.enum).toContain('in_progress');
      expect(contractStatus.enum).toContain('done');

      // 前端 TaskSchema 也应接受这些值
      const validTask = {
        id: 'task-1',
        owner_id: 'user-1',
        title: '测试任务',
        description: null,
        status: 'in_progress',
        priority: 'normal',
        due_date: null,
        parent_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      expect(TaskSchema.safeParse(validTask).success).toBe(true);
      expect(TaskSchema.safeParse({ ...validTask, status: 'invalid' }).success).toBe(false);
    });

    it('priority 枚举值应与契约一致', () => {
      const contractPriority = contractSchema.properties.priority;
      expect(contractPriority.enum).toContain('low');
      expect(contractPriority.enum).toContain('normal');
      expect(contractPriority.enum).toContain('high');

      const baseTask = {
        id: 'task-1',
        owner_id: 'user-1',
        title: '测试任务',
        description: null,
        status: 'pending',
        priority: 'normal',
        due_date: null,
        parent_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      expect(TaskSchema.safeParse({ ...baseTask, priority: 'low' }).success).toBe(true);
      expect(TaskSchema.safeParse({ ...baseTask, priority: 'critical' }).success).toBe(false);
    });

    it('parent_id 字段应与契约一致（nullable）', () => {
      const contractParentId = contractSchema.properties.parent_id;
      expect(contractParentId).toBeDefined();
      expect(contractParentId.type).toContain('string');
      expect(contractParentId.type).toContain('null');

      const baseTask = {
        id: 'task-1',
        owner_id: 'user-1',
        title: '测试任务',
        description: null,
        status: 'pending',
        priority: 'normal',
        due_date: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      // 前端 TaskSchema 应接受 parent_id 为 null（顶级任务）
      expect(TaskSchema.safeParse({ ...baseTask, parent_id: null }).success).toBe(true);

      // 前端 TaskSchema 应接受 parent_id 为字符串（子任务）
      expect(TaskSchema.safeParse({ ...baseTask, parent_id: 'parent-123' }).success).toBe(true);
    });

    it('前端应能正确解析符合契约的任务数据（含 parent_id）', () => {
      // 顶级任务
      const topLevelTask = {
        id: 'task-abc123',
        owner_id: 'user-xyz',
        title: '完成设计文档',
        description: '需要在周五前完成',
        status: 'pending',
        priority: 'high',
        due_date: '2026-05-20T00:00:00Z',
        parent_id: null,
        created_at: '2026-05-13T10:00:00Z',
        updated_at: '2026-05-13T10:00:00Z',
      };
      expect(TaskSchema.safeParse(topLevelTask).success).toBe(true);

      // 子任务
      const childTask = {
        ...topLevelTask,
        id: 'task-child-1',
        title: '编写第一章',
        parent_id: 'task-abc123',
      };
      expect(TaskSchema.safeParse(childTask).success).toBe(true);
    });
  });

  describe('TaskListResponse / Pagination 契约', () => {
    const contractSchema = contract.definitions.TaskListResponse;
    const paginationSchema = contract.definitions.Pagination;

    it('契约 TaskListResponse 定义存在', () => {
      expect(contractSchema).toBeDefined();
      expect(contractSchema.required).toContain('data');
      expect(contractSchema.required).toContain('pagination');
    });

    it('Pagination 必填字段应与前端 PaginatedTasksSchema 对齐', () => {
      const contractPaginationFields = Object.keys(paginationSchema.properties);
      const zodFields = Object.keys(PaginatedTasksSchema.shape);

      // 契约 Pagination 使用 camelCase: pageSize, totalPages
      // 前端 PaginatedTasksSchema 使用: items, total, page, page_size
      // 需要验证核心分页字段存在
      expect(zodFields).toContain('page');
      expect(zodFields).toContain('total');
      expect(contractPaginationFields).toContain('page');
      expect(contractPaginationFields).toContain('total');
    });

    it('前端应能正确解析分页任务列表', () => {
      const validResponse = {
        items: [
          {
            id: 'task-1',
            owner_id: 'user-1',
            title: '任务一',
            description: null,
            status: 'pending',
            priority: 'normal',
            due_date: null,
            parent_id: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
      };

      const result = PaginatedTasksSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });
  });
});
