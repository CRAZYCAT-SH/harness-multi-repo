# harness-governance — 治理仓库

CI/CD 工作流、E2E 测试、治理工具、可观测性栈、接口契约的集中管理仓库。

## 快速开始

pnpm install
pnpm e2e          # 本地 E2E（本地代码优先 + 镜像兜底）

## 本地目录约定

workspace/
├── harness-fe/           # 前端仓库（可选，E2E 自动检测）
├── harness-be/           # 后端仓库（可选，E2E 自动检测）
└── harness-governance/   # 本仓库

## 常用命令

| 命令 | 用途 |
|------|------|
| pnpm e2e | 本地 E2E 测试（本地优先 + 镜像兜底） |
| pnpm e2e:image | 全部使用镜像跑 E2E |
| pnpm lint:arch | 架构不变式校验 |
| pnpm docs:garden | 文档新鲜度扫描 |
| pnpm quality:score | 生成质量评分 |
