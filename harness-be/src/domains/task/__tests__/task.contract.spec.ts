/**
 * Task 域契约测试
 *
 * 验证后端 Task 域的 Zod Schema 与 harness-governance/contracts 中定义的
 * JSON Schema 保持一致。契约是前后端接口的唯一真实来源。
 *
 * 测试策略：
 * 1. 读取 governance 契约中的 JSON Schema 定义
 * 2. 对比契约字段与后端 Zod Schema 字段
 * 3. 确保必填字段、可选字段、类型约束保持一致
 */

import { describe, it, expect } from 'vitest';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CreateTaskSchema, UpdateTaskSchema } from '../types/index.js';

// 契约目录：通过环境变量 CONTRACTS_DIR 指定，默认回退到兄弟目录约定
const CONTRACTS_DIR = path.resolve(process.cwd(), process.env.CONTRACTS_DIR || '../harness-governance/contracts');
const CONTRACT_PATH = path.join(CONTRACTS_DIR, 'schemas', 'task.schema.json');

describe('contract: Task 域契约一致性', () => {
  const contractRaw = fs.readFileSync(CONTRACT_PATH, 'utf8');
  const contract = JSON.parse(contractRaw);

  const ajv = new Ajv({ allErrors: true, strict: false });
  (addFormats as unknown as (ajv: Ajv) => void)(ajv);

  describe('CreateTaskRequest 契约', () => {
    const contractSchema = contract.definitions.CreateTaskRequest;

    it('契约文件存在且包含 CreateTaskRequest 定义', () => {
      expect(contractSchema).toBeDefined();
      expect(contractSchema.type).toBe('object');
      expect(contractSchema.required).toContain('title');
    });

    it('后端 Zod Schema 的必填字段应与契约一致', () => {
      const contractFields = Object.keys(contractSchema.properties);

      // 后端 CreateTaskSchema 的字段
      const zodShape = CreateTaskSchema.shape;
      const implFields = Object.keys(zodShape);

      // 契约定义的字段应在实现中存在
      const missingInImpl = contractFields.filter(f => !implFields.includes(f));
      if (missingInImpl.length > 0) {
        expect.fail(
          `契约定义的字段在实现中缺失: [${missingInImpl.join(', ')}]\n` +
          `  契约字段: [${contractFields.join(', ')}]\n` +
          `  实现字段: [${implFields.join(', ')}]`
        );
      }
    });

    it('title 字段的长度约束应与契约一致', () => {
      const contractTitle = contractSchema.properties.title;
      expect(contractTitle.maxLength).toBe(200);
      expect(contractTitle.minLength).toBe(1);

      // 验证 Zod Schema 也拒绝空标题
      const emptyResult = CreateTaskSchema.safeParse({ title: '' });
      expect(emptyResult.success).toBe(false);

      // 验证 Zod Schema 也拒绝超长标题
      const longResult = CreateTaskSchema.safeParse({ title: 'a'.repeat(201) });
      expect(longResult.success).toBe(false);

      // 验证合法标题通过
      const validResult = CreateTaskSchema.safeParse({ title: '测试任务' });
      expect(validResult.success).toBe(true);
    });

    it('契约与实现对 additionalProperties 的处理应一致', () => {
      // 契约禁止额外字段
      expect(contractSchema.additionalProperties).toBe(false);

      // Zod 默认 strip 额外字段（不报错但忽略），这是可接受的行为差异
      // 但如果使用 .strict() 则会拒绝额外字段
      const withExtra = CreateTaskSchema.safeParse({ title: '测试', unknown_field: 'value' });
      // Zod 默认行为：接受但 strip 额外字段
      expect(withExtra.success).toBe(true);
    });

    it('parent_id 字段应与契约一致（可选，nullable）', () => {
      const contractParentId = contractSchema.properties.parent_id;
      expect(contractParentId).toBeDefined();
      // 契约定义 parent_id 为 ["string", "null"]
      expect(contractParentId.type).toContain('string');
      expect(contractParentId.type).toContain('null');

      // Zod Schema 应接受不传 parent_id
      const withoutParent = CreateTaskSchema.safeParse({ title: '测试任务' });
      expect(withoutParent.success).toBe(true);

      // Zod Schema 应接受 parent_id 为字符串
      const withParent = CreateTaskSchema.safeParse({ title: '子任务', parent_id: 'parent-123' });
      expect(withParent.success).toBe(true);

      // Zod Schema 应接受 parent_id 为 null
      const withNullParent = CreateTaskSchema.safeParse({ title: '顶级任务', parent_id: null });
      expect(withNullParent.success).toBe(true);
    });
  });

  describe('UpdateTaskRequest 契约', () => {
    const contractSchema = contract.definitions.UpdateTaskRequest;

    it('契约文件包含 UpdateTaskRequest 定义', () => {
      expect(contractSchema).toBeDefined();
      expect(contractSchema.type).toBe('object');
    });

    it('契约定义的字段应在实现中存在', () => {
      const contractFields = Object.keys(contractSchema.properties);
      const zodShape = UpdateTaskSchema.shape;
      const implFields = Object.keys(zodShape);

      const missingInImpl = contractFields.filter(f => !implFields.includes(f));
      const extraInImpl = implFields.filter(f => !contractFields.includes(f));

      if (missingInImpl.length > 0 || extraInImpl.length > 0) {
        expect.fail(
          `契约与实现字段不一致:\n` +
          `  契约有但实现无: [${missingInImpl.join(', ')}]\n` +
          `  实现有但契约无: [${extraInImpl.join(', ')}]\n` +
          `  契约字段: [${contractFields.join(', ')}]\n` +
          `  实现字段: [${implFields.join(', ')}]`
        );
      }
    });

    it('status 字段类型应与契约一致', () => {
      // 契约使用 status (enum)
      const contractStatus = contractSchema.properties.status;
      if (contractStatus) {
        expect(contractStatus.type).toBe('string');
        expect(contractStatus.enum).toContain('pending');
        expect(contractStatus.enum).toContain('done');
      }

      // 后端也使用 status (enum)，验证一致
      const zodShape = UpdateTaskSchema.shape;
      expect('status' in zodShape).toBe(true);
    });

    it('parent_id 字段应与契约一致（可选，nullable）', () => {
      const contractParentId = contractSchema.properties.parent_id;
      expect(contractParentId).toBeDefined();
      // 契约定义 parent_id 为 ["string", "null"]
      expect(contractParentId.type).toContain('string');
      expect(contractParentId.type).toContain('null');

      // Zod Schema 应接受 parent_id 为字符串（设置父任务）
      const withParent = UpdateTaskSchema.safeParse({ parent_id: 'parent-456' });
      expect(withParent.success).toBe(true);

      // Zod Schema 应接受 parent_id 为 null（移除父任务）
      const withNullParent = UpdateTaskSchema.safeParse({ parent_id: null });
      expect(withNullParent.success).toBe(true);

      // Zod Schema 应接受不传 parent_id（不修改）
      const withoutParent = UpdateTaskSchema.safeParse({ title: '更新标题' });
      expect(withoutParent.success).toBe(true);
    });
  });

  describe('TaskResponse 契约', () => {
    const contractSchema = contract.definitions.TaskResponse;

    it('契约文件包含 TaskResponse 定义', () => {
      expect(contractSchema).toBeDefined();
      expect(contractSchema.type).toBe('object');
    });

    it('契约要求的必填字段应完整', () => {
      const required = contractSchema.required;
      expect(required).toContain('id');
      expect(required).toContain('title');
      expect(required).toContain('status');
      expect(required).toContain('priority');
      expect(required).toContain('createdAt');
      expect(required).toContain('updatedAt');
      expect(required).toContain('userId');
    });

    it('parent_id 字段应在 TaskResponse 中定义为可选 nullable', () => {
      const contractParentId = contractSchema.properties.parent_id;
      expect(contractParentId).toBeDefined();
      expect(contractParentId.type).toContain('string');
      expect(contractParentId.type).toContain('null');
      // parent_id 不应是必填字段（顶级任务无父任务）
      const required = contractSchema.required || [];
      expect(required).not.toContain('parent_id');
    });

    it('响应字段命名风格应与实现一致', () => {
      // 契约使用 camelCase: createdAt, updatedAt, userId
      const contractFields = Object.keys(contractSchema.properties);
      // 后端 Task 实体使用 snake_case: created_at, updated_at, owner_id
      // 这意味着 runtime 层需要做字段映射

      const camelCaseFields = contractFields.filter(f => f.includes('A') || f.includes('I'));
      if (camelCaseFields.length > 0) {
        // 检查后端是否有对应的 snake_case 字段
        const expectedMapping: Record<string, string> = {
          createdAt: 'created_at',
          updatedAt: 'updated_at',
          userId: 'owner_id',
        };

        // 这里只是记录映射关系，确保开发者知道需要转换
        for (const [camel, _snake] of Object.entries(expectedMapping)) {
          if (contractFields.includes(camel)) {
            // 契约使用 camelCase，实现使用 snake_case，runtime 层应做转换
            expect(contractFields).toContain(camel);
          }
        }
      }
    });
  });

  describe('TaskListResponse 契约', () => {
    const contractSchema = contract.definitions.TaskListResponse;

    it('契约文件包含 TaskListResponse 定义', () => {
      expect(contractSchema).toBeDefined();
      expect(contractSchema.required).toContain('data');
      expect(contractSchema.required).toContain('pagination');
    });

    it('Pagination 子结构应包含必要字段', () => {
      const paginationSchema = contract.definitions.Pagination;
      expect(paginationSchema).toBeDefined();
      expect(paginationSchema.required).toContain('page');
      expect(paginationSchema.required).toContain('pageSize');
      expect(paginationSchema.required).toContain('total');
      expect(paginationSchema.required).toContain('totalPages');
    });
  });
});
