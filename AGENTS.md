# AGENTS.md — 多仓库项目代理上下文入口

> 本文件是 AI 代理（Kiro、Cursor、Copilot、Codex、Windsurf 等）在本工作区中操作的上下文入口和行为约束。
> 所有代理在执行任务前必须阅读并遵守本文件中的规则。

## 工作区结构

本工作区包含三个关联仓库，各自的 AGENTS.md 是对应项目的上下文入口和路线图。

| 仓库 | 角色 | 说明 | 上下文入口 |
|------|------|------|-----------|
| `harness-fe/` | 前端 | React + Vite SPA，任务管理应用用户界面 | `harness-fe/AGENTS.md` |
| `harness-be/` | 后端 | Fastify + TypeScript API，任务管理应用服务端 | `harness-be/AGENTS.md` |
| `harness-governance/` | 治理 | CI/CD 工作流、E2E 测试、治理工具、可观测性、接口契约 | `harness-governance/AGENTS.md` |

## 跨仓库协作规则

- 接口契约的唯一真实来源是 `harness-governance/contracts/`
- 前后端修改涉及接口变更时，必须先更新契约再实现
- E2E 测试统一由 harness-governance 驱动
- CI/CD 工作流由 harness-governance 提供可复用模板

## 契约驱动开发流程

当代码修改涉及接口变更（请求/响应字段、类型、枚举值、必填项等）时，必须遵循以下流程：

### 触发条件

以下文件的修改视为"接口变更"：
- `harness-governance/contracts/schemas/*.json` — 契约定义
- `harness-be/src/domains/*/types/index.ts` — 后端类型定义
- `harness-fe/src/api-client/schemas.ts` — 前端响应解析 Schema
- `harness-fe/src/types/index.ts` — 前端类型定义
- `harness-governance/contracts/openapi.yaml` — OpenAPI 规范

### 执行步骤（测试先行）

契约驱动开发遵循 **Test-First** 原则：先更新契约，再编写/更新测试用例，经用户审核后实现代码使测试通过。

```
1. 更新契约定义
   修改 harness-governance/contracts/schemas/ 下对应的 JSON Schema
       ↓
2. 设计并编写测试用例（三层）
   a. 契约测试：更新后端 __tests__/*.contract.spec.ts 和前端 __tests__/*.contract.spec.ts
      - 验证新字段在契约中的定义（类型、必填/可选、枚举值、约束）
      - 验证实现侧 Schema 与契约字段一致
   b. 单元测试：为新字段编写 Service/Repo 层单元测试
      - 覆盖新字段的创建、更新、查询、边界条件
      - 覆盖业务校验逻辑（如外键存在性、循环引用检测）
   c. E2E 测试：在 harness-governance/tests/e2e/ 中添加集成测试
      - 覆盖新字段的端到端 HTTP 请求/响应
      - 覆盖前端 UI 对新字段的展示和交互
       ↓
3. 用户审核测试用例
   将设计好的测试用例清单提交给用户审核：
   - 列出每个测试的名称、所属层级、验证目标
   - 说明覆盖的正向场景和边界/异常场景
   - 等待用户确认或提出修改意见
   - 根据反馈调整测试用例，直到用户审核通过
       ↓
4. 运行测试（预期全部失败）
   cd harness-be && pnpm test:contract  → 失败（实现未更新）
   cd harness-be && pnpm test           → 失败（新单元测试未通过）
   cd harness-fe && pnpm test:contract  → 失败（实现未更新）
   cd harness-fe && pnpm test           → 失败（新单元测试未通过）
       ↓
5. 实现后端代码
   - 数据库迁移（如需新增列）
   - 更新 Zod Schema 和类型定义
   - 更新 Repo 层（SQL 语句）
   - 更新 Service 层（业务逻辑）
   - 更新 Runtime 层（路由，如需新端点）
   - 逐步运行测试直到后端全部通过：
     cd harness-be && pnpm test:contract  → 通过
     cd harness-be && pnpm test           → 通过
       ↓
6. 实现前端代码
   - 更新类型定义（types/index.ts）
   - 更新 Zod Schema（api-client/schemas.ts）
   - 更新 API Client（如需新接口方法）
   - 更新 UI 组件（展示和交互）
   - 逐步运行测试直到前端全部通过：
     cd harness-fe && pnpm test:contract  → 通过
     cd harness-fe && pnpm test           → 通过
       ↓
7. E2E 验证
   cd harness-governance && pnpm e2e:fast  → 通过
```

### 测试用例设计规范

每次接口变更必须同时产出以下测试：

| 测试层级 | 位置 | 验证内容 | 运行命令 |
|----------|------|----------|----------|
| 契约测试 | `harness-be/src/domains/{domain}/__tests__/*.contract.spec.ts` | 后端 Schema 与契约 JSON Schema 字段一致 | `pnpm test:contract` |
| 契约测试 | `harness-fe/src/api-client/__tests__/*.contract.spec.ts` | 前端 Schema 与契约 JSON Schema 字段一致 | `pnpm test:contract` |
| 单元测试 | `harness-be/src/domains/{domain}/__tests__/*.spec.ts` | Service/Repo 层业务逻辑正确性 | `pnpm test` |
| 单元测试 | `harness-fe/src/**/__tests__/*.spec.ts` | 组件/Hook 对新字段的处理 | `pnpm test` |
| E2E 测试 | `harness-governance/tests/e2e/*.spec.ts` | 端到端 HTTP + UI 集成 | `pnpm e2e:fast` |

### 禁止行为

- 禁止跳过契约直接修改前后端接口代码
- 禁止在没有对应测试用例的情况下实现接口变更
- 禁止在测试用例未经用户审核确认的情况下开始实现
- 禁止同时修改契约和实现（必须分步：契约 → 测试 → 用户审核 → 实现）
- 禁止先写实现再补测试（必须测试先行）
- 禁止在任何一层测试失败的情况下继续下一层或提交 PR
- 禁止用修改测试用例的方式让测试通过（除非契约本身有误）
- 禁止前后端接口字段不一致时合并代码
- 禁止跳过 E2E 验证直接宣布任务完成

## AI 代理执行规范

当 AI 代理执行涉及接口变更的任务时，除遵守上述流程和禁止行为外，还必须在以下节点暂停并输出结构化信息：

#### 节点 1：测试用例审核（实现前）

完成测试用例设计后，输出以下清单等待用户确认：

```
## 测试用例审核清单

### 契约测试
| # | 测试名称 | 验证目标 |
|---|----------|----------|
| 1 | ... | ... |

### 单元测试
| # | 测试名称 | 验证目标 | 覆盖场景 |
|---|----------|----------|----------|
| 1 | ... | ... | 正向/边界/异常 |

### E2E 测试
| # | 测试名称 | 验证目标 |
|---|----------|----------|
| 1 | ... | ... |

请确认以上测试用例是否完整，或提出修改意见。
```

#### 节点 2：变更验证报告（实现后）

所有测试通过后，输出最终验证报告：

```
## 变更验证报告

### 契约变更
- 修改文件：[列出修改的契约文件]
- 新增字段：[列出新增的字段及类型]

### 测试覆盖
- 契约测试：X 个新增/修改（全部通过 ✓）
- 单元测试：X 个新增/修改（全部通过 ✓）
- E2E 测试：X 个新增/修改（全部通过 ✓）

### 实现变更
- 后端：[列出修改的文件]
- 前端：[列出修改的文件]

### 验证命令执行结果
- cd harness-be && pnpm test:contract  → ✓ 通过
- cd harness-be && pnpm test           → ✓ 通过
- cd harness-fe && pnpm test:contract  → ✓ 通过
- cd harness-fe && pnpm test           → ✓ 通过
- cd harness-governance && pnpm e2e:fast → ✓ 通过
```

## 常用命令速查

| 命令 | 工作目录 | 用途 |
|------|----------|------|
| `pnpm dev` | harness-governance | 同时启动前后端开发服务 |
| `pnpm dev` | harness-be | 启动后端开发服务（热重载） |
| `pnpm dev` | harness-fe | 启动前端开发服务（热重载） |
| `pnpm test` | harness-be | 运行后端全部测试 |
| `pnpm test` | harness-fe | 运行前端全部测试 |
| `pnpm test:contract` | harness-be | 运行后端契约测试 |
| `pnpm test:contract` | harness-fe | 运行前端契约测试 |
| `pnpm typecheck` | harness-be | 后端类型检查 |
| `pnpm typecheck` | harness-fe | 前端类型检查 |
| `pnpm build` | harness-be | 后端构建 |
| `pnpm build` | harness-fe | 前端构建 |
| `pnpm e2e:fast` | harness-governance | E2E 测试（快速模式） |
| `pnpm e2e` | harness-governance | E2E 测试（含可观测性） |

## 分层架构约束

### 后端（依赖方向单向，禁止反向引用）

```
types → config → repo → service → runtime
```

### 前端

```
types → api-client → hooks → components → pages
```

## 语言约束

- 始终使用中文回复用户的所有问题和请求
- 代码注释也优先使用中文
- 变量名、函数名等代码标识符保持英文
