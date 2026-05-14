---
status: validated
last_verified: "2025-01-15"
---

# 技术栈

本文档记录 harness-demo-fullstack 项目的所有直接依赖，包含选型理由与代理可读性评分。

## 选型原则

- 优先选择 API 稳定、文档完善、在代理训练语料中充分覆盖的"boring"技术
- 代理可读性评分（1-5）：5 = 代理几乎无需额外上下文即可正确使用

## 依赖清单

| 依赖名称 | 版本 | 用途 | 选型理由 | 代理可读性 |
|----------|------|------|----------|-----------|
| fastify | ^5.x | 后端 Web 框架 | 高性能、TypeScript 原生支持、插件体系清晰 | 5 |
| react | ^18.x | 前端 UI 框架 | 生态最成熟、代理训练语料覆盖最广 | 5 |
| vite | ^6.x | 前端构建工具 | 开发体验快、配置简洁、ESM 原生 | 5 |
| zod | ^3.x | 数据解析与验证 | TypeScript-first、Parse don't validate 哲学的最佳实现 | 5 |
| sql.js | ^1.x | SQLite 数据库（开发环境） | 零依赖、内存模式便于测试、无需本地安装 | 4 |
| bcryptjs | ^2.x | 密码哈希 | 纯 JS 实现、无原生编译依赖、API 简洁 | 5 |
| jsonwebtoken | ^9.x | JWT 签发与验证 | 使用最广泛的 JWT 库、API 稳定 | 5 |
| vitest | ^3.x | 单元/集成测试框架 | Vite 生态原生、兼容 Jest API、速度快 | 5 |
| playwright | ^1.x | 端到端测试框架 | 跨浏览器支持、API 直观、微软维护 | 4 |
| typescript | ^5.x | 类型系统 | strict 模式确保类型安全、代理可推断类型 | 5 |
| @opentelemetry/* | ^1.x | 可观测性 SDK | OpenTelemetry 标准实现、厂商中立 | 3 |
| uuid | ^11.x | UUID 生成 | 标准 RFC 4122 实现、零依赖 | 5 |
| react-router-dom | ^7.x | 前端路由 | React 生态标准路由方案 | 5 |
| tsx | ^4.x | TypeScript 执行器 | 零配置运行 TS 文件、开发脚本执行 | 5 |
| turbo | ^2.x | Monorepo 任务编排 | 增量构建、任务缓存、并行执行 | 4 |

## 新增依赖流程

当新的直接依赖被添加到任何 `package.json` 时，必须在本文档中补充对应条目。Architecture Linter 会校验此约束。
