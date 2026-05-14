---
status: validated
last_verified: "2025-01-15"
---

# 代理 PR 回路

本文档描述代理驱动的完整 PR 工作流（Agent PR Loop）。

## 完整回路流程

```
提示(Prompt) → 实现(Implement) → 自评审(Self-Review) → 修复(Fix) → 合并(Merge)
```

### 1. 提示（Prompt）

代理接收任务描述，定位相关上下文（通过 AGENTS.md 索引）。

### 2. 实现（Implement）

代理在独立分支上编写代码，遵循分层架构与黄金原则。

### 3. 自评审（Self-Review）

执行 `pnpm agent:self-review`，该命令依次运行：

1. `pnpm typecheck` — 类型检查
2. `pnpm lint:arch` — 架构不变式校验
3. `pnpm test` — 单元与集成测试
4. `pnpm docs:garden` — 文档新鲜度扫描
5. `pnpm quality:score` — 质量评分更新

### 4. 修复（Fix）

- 若所有步骤通过：生成 `.agent/self-review.md`，包含变更摘要、受影响域、API 变更、遗留 TODO、质量评分变化
- 若任一步骤失败：生成 `.agent/self-review-failures.md`，列出失败步骤、输出、相关文档链接；代理据此修复后重新执行自评审

### 5. 合并（Merge）

自评审通过后推送 PR，经 CI 门禁验证后合并。

## 自评审输出格式

```markdown
# Self-Review Report

## 变更摘要
...

## 受影响业务域
- auth / task / ...

## API 变更
- 新增 / 修改 / 删除的端点

## 遗留 TODO
- [ ] ...

## Quality Score 变化
| 域 | 变更前 | 变更后 |
|---|---|---|
```

## 关键约束

- 自评审必须在 PR 推送前完成
- 不得跳过任何自评审步骤
- 失败后必须修复再重试，不得带着已知失败推送
