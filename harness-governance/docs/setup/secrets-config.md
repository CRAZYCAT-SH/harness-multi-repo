# Secrets 与环境配置指南

本文档记录 multi-repo 架构下所有 GitHub Secrets、Environments 和权限的配置方法。

---

## 1. GitHub Secrets 配置

### 1.1 harness-fe（前端仓库）

| Secret 名称 | 用途 | 生成方式 |
|-------------|------|----------|
| `GOVERNANCE_REPO_TOKEN` | 触发 governance 仓库的 `repository_dispatch` | GitHub PAT (Fine-grained)，需 `contents:write` 权限 |
| `DEPLOY_TOKEN` | 部署到 staging/production | 根据部署平台生成 |

**配置路径**: Settings → Secrets and variables → Actions → New repository secret

### 1.2 harness-be（后端仓库）

| Secret 名称 | 用途 | 生成方式 |
|-------------|------|----------|
| `GOVERNANCE_REPO_TOKEN` | 触发 governance 仓库的 `repository_dispatch` | GitHub PAT (Fine-grained)，需 `contents:write` 权限 |
| `DEPLOY_TOKEN` | 部署到 staging/production | 根据部署平台生成 |

### 1.3 harness-governance（治理仓库）

| Secret 名称 | 用途 | 生成方式 |
|-------------|------|----------|
| `FRONTEND_REPO_TOKEN` | E2E 工作流检出前端仓库代码 | GitHub PAT，需前端仓库 `contents:read` 权限 |
| `BACKEND_REPO_TOKEN` | E2E 工作流检出后端仓库代码 | GitHub PAT，需后端仓库 `contents:read` 权限 |
| `REPO_TOKEN` | 质量门禁回写 PR 评论 | GitHub PAT，需目标仓库 `issues:write` 权限 |
| `DEPLOY_TOKEN` | 部署相关操作 | 根据部署平台生成 |

---

## 2. GitHub Environments 配置

### 2.1 staging 环境

- **适用仓库**: harness-fe, harness-be
- **保护规则**: 无需审批（自动部署）
- **配置路径**: Settings → Environments → New environment → "staging"

### 2.2 production 环境

- **适用仓库**: harness-fe, harness-be
- **保护规则**: 需审批人确认
- **配置步骤**:
  1. Settings → Environments → New environment → "production"
  2. 勾选 "Required reviewers"
  3. 添加审批人（至少 1 人）
  4. 可选：配置部署分支限制为 `main`

---

## 3. Package 权限配置

### 3.1 Docker 镜像授权

前后端仓库的 CI 会将 Docker 镜像推送到 `ghcr.io`。治理仓库的 E2E 工作流需要拉取这些镜像。

**配置步骤**:

1. 进入前端/后端仓库的 Package Settings:
   - `ghcr.io/harness-demo/harness-fe` → Settings
   - `ghcr.io/harness-demo/harness-be` → Settings

2. 在 "Manage Actions access" 中添加 `harness-governance` 仓库，授予 `read` 权限

3. 或者将镜像设为 Organization 内可见（推荐私有组织内使用）

### 3.2 GITHUB_TOKEN 权限

前后端仓库的 CI workflow 需要 `packages:write` 权限来推送镜像：

```yaml
permissions:
  packages: write
  contents: read
```

---

## 4. 开发者本地 Docker 登录

使用 E2E 镜像兜底模式前，开发者需要一次性配置 Docker 登录 ghcr.io：

### 4.1 生成 Personal Access Token

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. 创建新 Token，权限选择:
   - `read:packages`（读取 Container Registry）
3. 复制生成的 Token

### 4.2 登录 Docker Registry

```bash
# Linux / macOS
echo "<YOUR_GITHUB_TOKEN>" | docker login ghcr.io -u <your-github-username> --password-stdin

# Windows PowerShell
"<YOUR_GITHUB_TOKEN>" | docker login ghcr.io -u <your-github-username> --password-stdin
```

### 4.3 验证登录

```bash
docker pull ghcr.io/harness-demo/harness-fe:latest
```

如果拉取成功，说明配置正确。

---

## 5. Token 生成最佳实践

### Fine-grained Personal Access Token（推荐）

1. 限定 Resource owner 为组织
2. 限定 Repository access 为特定仓库
3. 最小权限原则：
   - `GOVERNANCE_REPO_TOKEN`: 仅需 governance 仓库的 `contents:write`
   - `FRONTEND_REPO_TOKEN`: 仅需前端仓库的 `contents:read`
   - `BACKEND_REPO_TOKEN`: 仅需后端仓库的 `contents:read`
   - `REPO_TOKEN`: 需目标仓库的 `issues:write`（用于评论）

### Token 轮换

- 建议设置 Token 过期时间（90 天）
- 在日历中设置提醒，到期前更新 Secrets
- 考虑使用 GitHub App 替代 PAT（更安全，无过期问题）

---

## 6. 故障排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| `repository_dispatch` 无响应 | Token 权限不足 | 确认 PAT 有目标仓库的 `contents:write` |
| E2E checkout 失败 | Token 过期或权限不足 | 重新生成 Token 并更新 Secret |
| Docker push 403 | `packages:write` 未配置 | 在 workflow 中添加 permissions |
| 质量门禁评论失败 | `issues:write` 缺失 | 更新 REPO_TOKEN 权限 |
| 本地 docker pull 401 | 未登录或 Token 无 `read:packages` | 重新执行 docker login |
