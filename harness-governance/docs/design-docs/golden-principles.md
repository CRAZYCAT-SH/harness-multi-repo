---
status: validated
last_verified: "2025-01-15"
---

# 黄金原则

本文档列出 harness-demo-fullstack 项目的黄金原则。每条原则均以 Linter 规则或测试形式机械化执行，而非仅靠文档约束。

## 原则列表

| # | 原则名称 | 理由 | 对应 Linter/测试规则 |
|---|----------|------|---------------------|
| 1 | 边界必须使用 Boundary_Parser | 所有外部数据（HTTP 请求、环境变量、数据库返回）在边界处解析为强类型，业务层无需猜测数据形状 | `no-raw-request-access`、`no-raw-env-access` |
| 2 | 禁止 any | `any` 类型绕过类型系统保护，使代理无法推断数据流向 | `no-any-type` |
| 3 | 禁止跨域直接引用 | 跨域耦合破坏模块边界，导致变更扩散不可控 | `no-cross-domain-import` |
| 4 | 禁止业务代码 console.* | 业务代码应使用结构化日志（LoggerProvider），console.* 无法被可观测性栈采集 | `no-console-in-business` |
| 5 | 禁止未经解析直接使用 process.env | 环境变量必须经 Zod schema 解析后通过 Config 层注入，避免运行时类型错误 | `no-raw-env-access` |
| 6 | 禁止未类型化的 HTTP 响应体 | 前后端响应体必须经 Zod schema 解析，确保契约一致性 | `no-untyped-response` |

## 执行方式

- 所有原则通过 `pnpm lint:arch` 在 CI 中强制执行
- 违规时输出：违规文件路径、规则名称、修复指引、相关文档链接
- 任一违规将阻塞 PR 合并
