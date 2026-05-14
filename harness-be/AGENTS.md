# AGENTS.md — harness-be 代理上下文入口

## 本仓库概述

Fastify + TypeScript 后端 API，任务管理应用的服务端。

## 关联仓库

| 仓库 | 地址 | 关系 | 说明 |
|------|------|------|------|
| harness-fe | github.com/<org>/harness-fe | 下游消费方 | 消费本仓库的 HTTP API |
| harness-governance | github.com/<org>/harness-governance | 治理方 | CI/CD 工作流、E2E 测试、质量门禁 |

## 领域地图

| 业务域 | 位置 | 职责 |
|--------|------|------|
| auth | src/domains/auth/ | 用户注册、登录、JWT 认证 |
| task | src/domains/task/ | 任务 CRUD、分页查询、搜索 |

## 分层依赖方向

types → config → repo → service → runtime（禁止反向）

## 接口契约

- 契约来源：harness-governance/contracts/openapi.yaml
- 本地校验：pnpm test:contract

## 本地集成测试

1. 确保 harness-governance 在兄弟目录（../harness-governance/）
2. cd ../harness-governance && pnpm e2e

## 常用命令

| 命令 | 用途 |
|------|------|
| pnpm dev | 启动开发服务 |
| pnpm build | 构建 |
| pnpm start | 启动生产服务 |
| pnpm test | 运行单元测试 |
| pnpm typecheck | 类型检查 |
