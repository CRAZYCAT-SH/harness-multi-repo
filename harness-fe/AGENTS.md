# AGENTS.md — harness-fe 代理上下文入口

## 本仓库概述

React + Vite 前端 SPA，任务管理应用的用户界面。

## 关联仓库

| 仓库 | 地址 | 关系 | 说明 |
|------|------|------|------|
| harness-be | github.com/<org>/harness-be | 上游依赖 | 本仓库调用其 HTTP API |
| harness-governance | github.com/<org>/harness-governance | 治理方 | CI/CD 工作流、E2E 测试、质量门禁 |

## 分层依赖方向

types → api-client → hooks → components → pages（禁止反向）

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
| pnpm build | 构建生产版本 |
| pnpm test | 运行单元测试 |
| pnpm typecheck | 类型检查 |
