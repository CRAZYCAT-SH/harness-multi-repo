# Harness Demo — 企业级多仓库 Harness Engineering 实践

## 什么是 Harness Engineering

Harness Engineering（线束工程）是 OpenAI 在 2026 年 2 月提出的工程方法论。其核心观点是：当 AI 代理成为主要的代码生产者时，工程师的职责从"写代码"转变为"构建让代理高效工作的环境、约束和反馈循环"。

> 原文参考：[Harness engineering: leveraging Codex in an agent-first world](https://openai.com/zh-Hans-CN/index/harness-engineering/)

OpenAI 团队用 5 个月时间，在一个空仓库上由 Codex 代理生成了约 100 万行代码，交付了一个有真实用户的内部产品，人类工程师全程零手写代码。他们总结出的核心原则：

- **Humans steer, agents execute** — 人类负责方向，代理负责执行
- **Agent legibility over human readability** — 代码优化为代理可读，而非仅人类可读
- **Boring technology** — 选择 AI 训练语料中充分覆盖的成熟技术
- **Observability as feedback loop** — 可观测性是代理的反馈回路
- **AGENTS.md as context entry** — 仓库级上下文入口文件
- **Worktree isolation** — 每个任务独立工作树，代理互不干扰

## 本项目与原生 Harness 的关键区别

OpenAI 的原生 Harness 实验是在**单一 Monorepo + Symphony 编排器**的极端场景下进行的。本项目将其方法论适配为**企业级多仓库（Multi-repo）架构**，更贴近真实企业的组织结构和工程现实。

### 对比总览

| 维度 | OpenAI 原生 Harness | 本项目（企业级适配） |
|------|---------------------|---------------------|
| 仓库策略 | 单一 Monorepo | Multi-repo（前端/后端/治理分仓） |
| 编排系统 | Symphony（Elixir 守护进程） | 轻量 TypeScript 编排脚本 + CI workflow_call |
| 代理模式 | Codex 全自主（0% 人类代码） | 人机协作（代理辅助，人类审查） |
| 代码审查 | Agent-to-Agent Review | 人类 Review + 代理辅助 self-review |
| 任务来源 | Linear 看板自动分发 | PR/Push 触发 + 手动编排 |
| 隔离方式 | Git Worktree（单仓库内） | 独立仓库 + 动态端口隔离 |
| 可观测性 | 每个 Worktree 独立栈 | 共享可观测性栈 + 按服务隔离 |
| 团队规模 | 3-7 人极客团队 | 适配多团队、多项目组织 |
| 接口管理 | 仓库内模块边界 | 显式 OpenAPI 契约 + JSON Schema |
| CI/CD | 仓库内统一 | 跨仓库 workflow_call + repository_dispatch |

### 为什么选择 Multi-repo

| 企业现实 | Monorepo 的挑战 | Multi-repo 的优势 |
|----------|----------------|-------------------|
| 多团队并行开发 | 代码冲突频繁，CI 排队 | 团队独立迭代，互不阻塞 |
| 独立部署节奏 | 全量构建耗时，部署耦合 | 各服务独立发布，灰度可控 |
| 权限隔离 | 仓库级权限粒度不够 | 天然的代码访问边界 |
| 技术栈异构 | 工具链统一成本高 | 各仓库自选最优工具链 |
| 外包/供应商协作 | 暴露全量代码 | 按仓库授权，最小暴露 |
| 合规审计 | 变更追溯复杂 | 仓库级审计日志清晰 |

本项目通过 **governance 仓库**解决 Multi-repo 的协作难题：契约统一、CI 复用、E2E 集成、质量门禁。

## 仓库结构

```
multi-repo/                   ← 本地开发工作区（不入版本控制）
├── AGENTS.md                 ← 本地代理约束（见下方说明）
├── README.md                 ← 本文件
├── harness-fe/               # 前端 — React + Vite SPA
├── harness-be/               # 后端 — Fastify + TypeScript API
└── harness-governance/       # 治理 — CI/CD、E2E、契约、可观测性、质量工具
```

### 关于外层 AGENTS.md

根目录的 `AGENTS.md` 是**本地开发环境专用**的代理约束文件：

- 它为本地多仓库联合开发场景提供跨仓库的协作规则和契约驱动流程
- **不与任何远程仓库同步**，不纳入任何子项目的版本控制
- 各子仓库（harness-fe、harness-be、harness-governance）各自有独立的 `AGENTS.md`，随仓库版本控制
- 本地 `AGENTS.md` 适配多种代理工具（Kiro、Cursor、Copilot、Codex、Windsurf 等），是开发者根据本地环境自行维护的文件

## 核心适配设计

### 1. 契约驱动替代模块边界

OpenAI 在 Monorepo 中通过目录结构和 AGENTS.md 定义模块边界。本项目在 Multi-repo 中通过**显式接口契约**实现同等效果：

```
harness-governance/contracts/
├── openapi.yaml              # RESTful API 契约（唯一真实来源）
└── schemas/
    ├── auth.schema.json      # 认证领域数据结构
    └── task.schema.json      # 任务领域数据结构
```

前后端各自通过 `pnpm test:contract` 校验实现是否符合契约。代理修改接口时，必须先更新契约文件，CI 自动阻断不一致的变更。

### 2. Governance 仓库替代 Symphony

| Symphony 职责 | 本项目对应实现 |
|--------------|---------------|
| 任务分发 | GitHub Actions workflow_dispatch / repository_dispatch |
| 工作空间隔离 | 动态端口分配 + Docker 容器隔离 |
| 代理执行 | E2E 编排脚本（TypeScript） |
| 结果验证 | Playwright 测试 + 可观测性查询 |
| 报告生成 | 结构化 Markdown + JSON 报告 |

### 3. 跨仓库 AGENTS.md 体系

```
harness-fe/AGENTS.md          → 前端代理上下文（分层规则、组件约定）
harness-be/AGENTS.md          → 后端代理上下文（领域地图、依赖方向）
harness-governance/AGENTS.md  → 治理代理上下文（命令说明、E2E 规范）
./AGENTS.md                   → 本地跨仓库约束（契约流程、协作规则）
```

### 4. 分层可观测性

- OTel Collector 统一接收所有服务的 traces/metrics/logs
- 通过 `OTEL_SERVICE_NAME` 区分前端/后端
- E2E 测试后自动查询，将可观测性数据关联到具体测试用例
- 失败用例自动附带 trace_id，支持端到端链路排查

## Harness 方法论核心实践

### Agent Legibility — 代理可读性

**技术选型**：所有依赖优先选择 AI 训练语料中充分覆盖的"无聊技术"（Boring Technology）。

**UI 可读性**：前端所有可交互元素提供语义化 `data-testid`：

| 元素类型 | 命名格式 | 示例 |
|----------|----------|------|
| 页面容器 | `page-{name}` | `page-login` |
| 输入框 | `input-{field}` | `input-email` |
| 按钮 | `btn-{action}` | `btn-submit` |
| 列表项 | `item-{list}-{id}` | `item-tasks-abc123` |

### 分层架构约束

**后端**（依赖方向单向，禁止反向引用）：

```
types → config → repo → service → runtime
```

**前端**：

```
types → api-client → hooks → components → pages
```

### 知识仓库化

所有决策推入仓库，不藏在 Google Docs、Slack 或人脑中：

- 技术选型理由 → `docs/design-docs/tech-stack.md`
- UI 规范 → `docs/design-docs/ui-legibility.md`
- 接口契约 → `contracts/openapi.yaml`
- 代理上下文 → `AGENTS.md`

### 治理工具集

| 工具 | 职责 | 对应 Harness 原则 |
|------|------|-------------------|
| arch-linter | 检查分层约束和依赖方向 | 架构即代码 |
| doc-gardener | 检查文档完整性和链接有效性 | 知识仓库化 |
| quality-score | 综合质量评分 | 可量化的反馈 |
| self-review | 代码自审查辅助 | Agent Review |
| ui-snapshot | 页面结构化 DOM 快照 | Application Legibility |
| worktree-launcher | 多仓库工作树管理 | Worktree Isolation |

## 技术栈

| 层级 | 技术选型 | 代理可读性 | 选型理由 |
|------|----------|-----------|----------|
| 前端框架 | React 18 + Vite 6 | ⭐⭐⭐⭐⭐ | 生态最成熟，训练语料覆盖最广 |
| 后端框架 | Fastify 5 + TypeScript | ⭐⭐⭐⭐⭐ | 高性能，TS 原生支持 |
| 数据验证 | Zod | ⭐⭐⭐⭐⭐ | TypeScript-first，Parse don't validate |
| 数据库 | sql.js（SQLite 内存） | ⭐⭐⭐⭐ | 零依赖，便于测试 |
| 认证 | JWT + bcryptjs | ⭐⭐⭐⭐⭐ | 纯 JS，API 简洁 |
| 单元测试 | Vitest | ⭐⭐⭐⭐⭐ | Vite 原生，兼容 Jest |
| E2E 测试 | Playwright | ⭐⭐⭐⭐ | 跨浏览器，API 直观 |
| 可观测性 | OpenTelemetry | ⭐⭐⭐ | 厂商中立，标准协议 |
| 包管理 | pnpm | ⭐⭐⭐⭐⭐ | 严格依赖隔离 |

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 9.15
- Docker（可选，用于可观测性栈和镜像模式）
- Chrome 浏览器（Playwright E2E 测试）

### 安装依赖

```bash
cd harness-fe && pnpm install
cd ../harness-be && pnpm install
cd ../harness-governance && pnpm install
```

### 本地开发

```bash
# 一键启动前后端（推荐）
cd harness-governance && pnpm dev

# 或分别启动
cd harness-be && pnpm dev
cd harness-fe && pnpm dev
```

### 运行测试

```bash
# 契约测试
cd harness-be && pnpm test:contract
cd harness-fe && pnpm test:contract

# 单元测试
cd harness-be && pnpm test
cd harness-fe && pnpm test

# E2E 测试
cd harness-governance && pnpm e2e:fast
```

## 契约驱动开发流程

接口变更必须遵循"契约先行、测试先行"原则。完整流程和规则详见 [`AGENTS.md`](./AGENTS.md)。

核心步骤：

```
契约定义 → 测试设计 → 用户审核 → 测试失败 → 实现代码 → 测试通过 → E2E 验证
```

## CI/CD 流程

```
代码 Push/PR
    ↓
Caller Workflow（各仓库 .github/workflows/ci.yml）
    ↓
governance/ci-node.yml（workflow_call 复用）
    ↓
合并到 main
    ↓
发布 Docker 镜像 + repository_dispatch
    ↓
governance E2E 集成测试
    ↓
结构化报告（Markdown + JSON）
```

## 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 仓库策略 | Multi-repo | 独立部署、独立版本、权限隔离、适配企业组织结构 |
| 治理模式 | 独立 Governance 仓库 | 集中管理契约/CI/E2E，避免治理逻辑分散 |
| 编排方式 | TypeScript 脚本 | 轻量、无额外基础设施依赖、团队易维护 |
| 数据库 | SQLite 内存模式 | Demo 项目聚焦方法论，简化环境搭建 |
| 认证方案 | 无状态 JWT | 无需 session 存储，适合 API 服务 |
| 测试策略 | 单元 + 契约 + E2E（测试先行） | 分层覆盖，契约保证跨仓库一致性，TDD 保证实现正确性 |
| 可观测性 | OpenTelemetry | 厂商中立，一次埋点多处消费 |
| 端口分配 | 动态分配 | 避免多实例冲突，支持并行测试 |

## 适用场景

- **多团队协作**：前端团队、后端团队、平台团队各自管理独立仓库
- **独立部署**：各服务按自身节奏发布，无需全量协调
- **渐进式 AI 采纳**：从人机协作逐步过渡到更高自动化程度
- **合规要求**：仓库级权限隔离，变更审计清晰
- **供应商协作**：按仓库授权，最小化代码暴露
- **多项目复用**：治理仓库的工具和工作流可复用到其他项目组

## 参考资料

- [Harness engineering: leveraging Codex in an agent-first world — OpenAI](https://openai.com/zh-Hans-CN/index/harness-engineering/)
- [An open-source spec for Codex orchestration: Symphony — OpenAI](https://openai.com/index/open-source-codex-orchestration-symphony/)
- [Symphony GitHub Repository](https://github.com/openai/symphony)

## 许可证

MIT
