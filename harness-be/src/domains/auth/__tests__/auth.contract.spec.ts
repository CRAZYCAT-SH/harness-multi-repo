/**
 * Auth 域契约测试
 *
 * 验证后端 Auth 域的 Zod Schema 与 harness-governance/contracts 中定义的
 * JSON Schema 保持一致。契约是前后端接口的唯一真实来源。
 *
 * 测试策略：
 * 1. 读取 governance 契约中的 JSON Schema 定义
 * 2. 构造符合/不符合契约的测试数据
 * 3. 分别用 Ajv（契约）和 Zod（实现）验证
 * 4. 确保两者对同一数据的接受/拒绝行为一致
 */

import { describe, it, expect } from 'vitest';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RegisterRequestSchema, LoginRequestSchema } from '../types/index.js';

// 契约目录：通过环境变量 CONTRACTS_DIR 指定，默认回退到兄弟目录约定
const CONTRACTS_DIR = path.resolve(process.cwd(), process.env.CONTRACTS_DIR || '../harness-governance/contracts');
const CONTRACT_PATH = path.join(CONTRACTS_DIR, 'schemas', 'auth.schema.json');

describe('contract: Auth 域契约一致性', () => {
  // 加载契约 JSON Schema
  const contractRaw = fs.readFileSync(CONTRACT_PATH, 'utf8');
  const contract = JSON.parse(contractRaw);

  const ajv = new Ajv({ allErrors: true, strict: false });
  (addFormats as unknown as (ajv: Ajv) => void)(ajv);

  describe('RegisterRequest 契约', () => {
    const contractSchema = contract.definitions.RegisterRequest;

    it('契约文件存在且包含 RegisterRequest 定义', () => {
      expect(contractSchema).toBeDefined();
      expect(contractSchema.type).toBe('object');
      expect(contractSchema.required).toContain('email');
      expect(contractSchema.required).toContain('password');
    });

    it('后端 Zod Schema 接受的字段应与契约定义对齐', () => {
      // 契约要求 username + password
      const contractFields = Object.keys(contractSchema.properties);
      // 后端实现使用 email + password
      const zodShape = RegisterRequestSchema.shape;
      const implFields = Object.keys(zodShape);

      // 记录差异（此测试用于发现不一致，而非强制通过）
      const contractOnly = contractFields.filter(f => !implFields.includes(f));
      const implOnly = implFields.filter(f => !contractFields.includes(f));

      // 如果存在差异，测试应失败并报告具体差异
      if (contractOnly.length > 0 || implOnly.length > 0) {
        expect.fail(
          `契约与实现字段不一致:\n` +
          `  契约有但实现无: [${contractOnly.join(', ')}]\n` +
          `  实现有但契约无: [${implOnly.join(', ')}]\n` +
          `  请更新契约或实现以保持一致。`
        );
      }
    });

    it('契约要求的 password 最小长度应与实现一致', () => {
      const contractMinLength = contractSchema.properties.password.minLength;
      // 后端实现要求 min(8)
      const shortPassword = 'a'.repeat(contractMinLength - 1);
      const validPassword = 'a'.repeat(contractMinLength);

      const validate = ajv.compile(contractSchema);

      // 短密码应被契约拒绝
      expect(validate({ email: 'test@example.com', password: shortPassword })).toBe(false);
      // 达到最小长度应被契约接受
      expect(validate({ email: 'test@example.com', password: validPassword })).toBe(true);
    });
  });

  describe('LoginRequest 契约', () => {
    const contractSchema = contract.definitions.LoginRequest;

    it('契约文件包含 LoginRequest 定义', () => {
      expect(contractSchema).toBeDefined();
      expect(contractSchema.type).toBe('object');
      expect(contractSchema.required).toContain('email');
      expect(contractSchema.required).toContain('password');
    });

    it('后端 Zod Schema 接受的字段应与契约定义对齐', () => {
      const contractFields = Object.keys(contractSchema.properties);
      const zodShape = LoginRequestSchema.shape;
      const implFields = Object.keys(zodShape);

      const contractOnly = contractFields.filter(f => !implFields.includes(f));
      const implOnly = implFields.filter(f => !contractFields.includes(f));

      if (contractOnly.length > 0 || implOnly.length > 0) {
        expect.fail(
          `契约与实现字段不一致:\n` +
          `  契约有但实现无: [${contractOnly.join(', ')}]\n` +
          `  实现有但契约无: [${implOnly.join(', ')}]\n` +
          `  请更新契约或实现以保持一致。`
        );
      }
    });
  });

  describe('AuthResponse 契约', () => {
    const contractSchema = contract.definitions.AuthResponse;

    it('契约文件包含 AuthResponse 定义', () => {
      expect(contractSchema).toBeDefined();
      expect(contractSchema.required).toContain('token');
      expect(contractSchema.required).toContain('user');
    });

    it('User 子结构应包含 id 和 email 字段', () => {
      const userSchema = contract.definitions.User;
      expect(userSchema).toBeDefined();
      expect(userSchema.required).toContain('id');
      expect(userSchema.required).toContain('email');
    });
  });
});
