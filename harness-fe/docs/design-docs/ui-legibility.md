---
status: validated
last_verified: "2025-01-15"
---

# UI 代理可读性规范

本文档描述前端 UI 对代理可读的设计规范，确保代理能通过结构化方式观察和操作 UI。

## data-testid 命名约定

所有可交互元素必须提供 `data-testid` 属性，命名规则如下：

| 元素类型 | 命名格式 | 示例 |
|----------|----------|------|
| 页面容器 | `page-{pageName}` | `page-login`、`page-tasks` |
| 表单 | `form-{formName}` | `form-login`、`form-create-task` |
| 输入框 | `input-{fieldName}` | `input-email`、`input-password` |
| 按钮 | `btn-{action}` | `btn-submit`、`btn-delete` |
| 列表 | `list-{listName}` | `list-tasks` |
| 列表项 | `item-{listName}-{id}` | `item-tasks-abc123` |
| 对话框 | `dialog-{dialogName}` | `dialog-confirm-delete` |
| Toast 提示 | `toast-{type}` | `toast-error`、`toast-success` |
| 导航链接 | `nav-{target}` | `nav-tasks`、`nav-logout` |

## DOM 快照工具

通过 `pnpm agent:ui-snapshot <url>` 命令，代理可获取指定页面的结构化 DOM 描述。

### 使用方式

```bash
pnpm agent:ui-snapshot http://localhost:3000/tasks
```

### 输出位置

快照保存到 `.agent/ui-snapshots/` 目录，包含：

- `snapshot.json` — 结构化 DOM 描述
- `screenshot.png` — 页面截图

## 结构化 DOM 描述格式

```json
{
  "url": "http://localhost:3000/tasks",
  "timestamp": "2025-01-15T10:00:00Z",
  "viewport": { "width": 1280, "height": 720 },
  "elements": [
    {
      "testId": "page-tasks",
      "tag": "main",
      "children": [
        {
          "testId": "list-tasks",
          "tag": "ul",
          "children": [
            {
              "testId": "item-tasks-abc123",
              "tag": "li",
              "text": "完成设计文档",
              "attributes": { "data-status": "pending" }
            }
          ]
        }
      ]
    }
  ]
}
```

## 设计原则

- 每个可交互元素必须有唯一的 `data-testid`
- `data-testid` 命名应自描述，代理无需查看源码即可理解元素用途
- 列表项的 `data-testid` 包含业务 ID，便于代理定位特定条目
- 状态信息通过 `data-*` 属性暴露，避免代理解析 CSS 类名
