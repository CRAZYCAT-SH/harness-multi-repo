# AGENTS.md — harness-governance 代理上下文入口

## 本仓库概述

Harness 治理仓库，集中管理 CI/CD 工作流、E2E 测试、治理工具、可观测性栈和接口契约。

## 关联仓库

| 仓库 | 地址 | 关系 | 说明 |
|------|------|------|------|
| harness-fe | github.com/<org>/harness-fe | 被治理方 | 前端应用，CI/CD 由本仓库工作流驱动 |
| harness-be | github.com/<org>/harness-be | 被治理方 | 后端 API，CI/CD 由本仓库工作流驱动 |

## 职责范围

- 可复用 CI/CD 工作流（workflow_call）
- E2E 测试（Playwright）
- 治理工具（arch-linter、doc-gardener、quality-score、self-review、worktree-launcher、ui-snapshot）
- 可观测性栈（OTel + Victoria）
- 接口契约（OpenAPI + JSON Schema）
- 跨仓库文档

## 接口契约

契约定义在 contracts/ 目录，是前后端接口的唯一真实来源：
- contracts/openapi.yaml
- contracts/schemas/auth.schema.json
- contracts/schemas/task.schema.json

## E2E 测试规范

执行 pnpm e2e 时：
1. 动态分配端口 → 写入 .worktree/ports.json
2. 启动可观测性栈
3. 检测兄弟目录 → 本地代码优先 / Docker 镜像兜底
4. 执行 Playwright
5. 查询可观测性栈 → 生成报告

## 常用命令

| 命令 | 用途 | 说明 |
|------|------|------|
| pnpm e2e | 完整 E2E 测试 | 启动可观测性栈 + 前后端服务 + Playwright 测试 + 查询指标生成报告，适合 CI 或需要完整可观测性数据的场景 |
| pnpm e2e:fast | 快速 E2E 测试 | 跳过可观测性栈，仅启动前后端服务并执行 Playwright 测试，适合本地开发快速验证功能 |
| pnpm e2e:image | Docker 镜像 E2E | 前后端均使用 Docker 镜像运行（不依赖本地代码），模拟生产环境部署后的集成测试 |
| pnpm test:e2e | 仅执行 Playwright | 不启动任何服务，直接运行 Playwright 测试，需要服务已在运行中（手动启动或外部编排） |
| pnpm lint:arch | 架构规范检查 | 运行 arch-linter 工具，检查前后端代码是否符合架构约束（依赖方向、分层规范等） |
| pnpm docs:garden | 文档维护 | 运行 doc-gardener 工具，检查文档完整性、链接有效性、过期内容等 |
| pnpm quality:score | 质量评分 | 运行 quality-score 工具，综合代码覆盖率、lint 结果、文档完整度等维度生成项目质量分数 |

### E2E 命令行参数

以下参数可与 `pnpm e2e` 组合使用：

| 参数 | 说明 |
|------|------|
| --fe-image | 强制前端使用 Docker 镜像，忽略本地 harness-fe 代码 |
| --be-image | 强制后端使用 Docker 镜像，忽略本地 harness-be 代码 |
| --no-observability | 跳过可观测性栈（OTel Collector + VictoriaLogs/Metrics/Traces），报告中不含指标数据 |
| --keep-infra | 测试完成后保留可观测性栈容器，便于手动查询日志和追踪数据排查问题 |
