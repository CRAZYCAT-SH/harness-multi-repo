/**
 * Auth 域契约测试（前端）
 *
 * 验证前端 API 客户端的 Zod Schema 与 harness-governance/contracts 中定义的
 * JSON Schema 保持一致。确保前端对后端响应的解析与契约定义对齐。
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { UserSchema, AuthResponseSchema } from '../schemas';

// 契约目录：通过环境变量 CONTRACTS_DIR 指定，默认回退到兄弟目录约定
const CONTRACTS_DIR = path.resolve(process.cwd(), process.env.CONTRACTS_DIR || '../harness-governance/contracts');
const CONTRACT_PATH = path.join(CONTRACTS_DIR, 'schemas', 'auth.schema.json');

describe('contract: Auth 前端契约一致性', () => {
  const contractRaw = fs.readFileSync(CONTRACT_PATH, 'utf8');
  const contract = JSON.parse(contractRaw);

  describe('User Schema', () => {
    const contractSchema = contract.definitions.User;

    it('契约 User 定义存在', () => {
      expect(contractSchema).toBeDefined();
      expect(contractSchema.required).toContain('id');
      expect(contractSchema.required).toContain('email');
    });

    it('前端 UserSchema 字段应与契约对齐', () => {
      const contractFields = Object.keys(contractSchema.properties);
      const zodFields = Object.keys(UserSchema.shape);

      const contractOnly = contractFields.filter(f => !zodFields.includes(f));
      const implOnly = zodFields.filter(f => !contractFields.includes(f));

      if (contractOnly.length > 0 || implOnly.length > 0) {
        expect.fail(
          `契约与前端 UserSchema 字段不一致:\n` +
          `  契约有但前端无: [${contractOnly.join(', ')}]\n` +
          `  前端有但契约无: [${implOnly.join(', ')}]`
        );
      }
    });
  });

  describe('AuthResponse Schema', () => {
    const contractSchema = contract.definitions.AuthResponse;

    it('契约 AuthResponse 定义存在', () => {
      expect(contractSchema).toBeDefined();
      expect(contractSchema.required).toContain('token');
      expect(contractSchema.required).toContain('user');
    });

    it('前端 AuthResponseSchema 字段应与契约对齐', () => {
      const contractFields = Object.keys(contractSchema.properties);
      const zodFields = Object.keys(AuthResponseSchema.shape);

      const contractOnly = contractFields.filter(f => !zodFields.includes(f));
      const implOnly = zodFields.filter(f => !contractFields.includes(f));

      if (contractOnly.length > 0 || implOnly.length > 0) {
        expect.fail(
          `契约与前端 AuthResponseSchema 字段不一致:\n` +
          `  契约有但前端无: [${contractOnly.join(', ')}]\n` +
          `  前端有但契约无: [${implOnly.join(', ')}]`
        );
      }
    });

    it('前端应能正确解析符合契约的响应数据', () => {
      const validResponse = {
        token: 'eyJhbGciOiJIUzI1NiJ9.test.signature',
        user: { id: 'user-123', email: 'test@example.com' },
      };

      const result = AuthResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('前端应拒绝不符合契约的响应数据', () => {
      const invalidResponse = {
        token: 123, // 应为 string
        user: { id: 'user-123' }, // 缺少 email
      };

      const result = AuthResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });
});
