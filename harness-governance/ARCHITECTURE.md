# 多仓库架构总览

## 仓库拓扑

| 仓库 | 地址 | 职责 |
|------|------|------|
| harness-fe | github.com/<org>/harness-fe | React 前端 SPA |
| harness-be | github.com/<org>/harness-be | Fastify 后端 API |
| harness-governance | github.com/<org>/harness-governance | CI/CD + E2E + 治理 |

## 依赖方向

harness-fe →（HTTP API）→ harness-be
harness-governance →（checkout/image）→ harness-fe, harness-be

## 通信方式

- workflow_call：CI 逻辑复用（同步，结果回显到调用方 PR）
- repository_dispatch：跨仓库触发（异步，E2E / 质量门禁）

## 本地开发目录约定

workspace/
├── harness-fe/
├── harness-be/
└── harness-governance/

三个仓库并排放置，E2E 编排脚本自动检测兄弟目录。

## 接口契约

API 契约定义在：harness-governance/contracts/openapi.yaml
前后端各自通过 pnpm test:contract 校验是否符合契约。

## CI/CD 流程

代码 push/PR → Caller Workflow → governance/ci-node.yml（workflow_call）
合并到 main → 发布 Docker 镜像 + repository_dispatch → governance E2E
