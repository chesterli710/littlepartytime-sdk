# CLAUDE.md

本文档定义了在此仓库中修复 Bug 和开发新 Feature 的完整工作流程。

## Step 1: 读取 GitHub Issues

```bash
# 列出所有 open issues
gh issue list --state open

# 查看某个 issue 的详细信息
gh issue view <number> --json title,body,labels,comments
```

阅读 issue 时重点关注：
- 错误信息和涉及的文件
- 复现步骤
- issue 作者建议的修复方向

## Step 2: 修改代码并确保正确

### 2.1 定位问题

- 根据 issue 中的错误信息和文件路径定位源码
- 理解问题的根因，而不是只修表面症状

### 2.2 编写修复 / 实现功能

- 遵循现有代码风格和模式
- 如果涉及新功能，同步编写测试

### 2.3 运行测试

```bash
# 运行受影响包的测试
npm run test --workspace=@littlepartytime/sdk
npm run test --workspace=@littlepartytime/dev-kit

# 运行全量测试，确认无回归
npm test
```

### 2.4 构建并检查产物

```bash
# 构建受影响的包
npm run build --workspace=<package>

# 用 dry-run 检查将要发布的文件是否正确
cd packages/<package>
npm pack --dry-run
```

确认产物中没有多余文件、没有遗漏文件。

### 2.5 集成验证（推荐）

在临时目录安装发布后的包，验证实际可用：

```bash
mkdir /tmp/test-pkg && cd /tmp/test-pkg
npm init -y
npm install <package-name>@<version>
# 运行基本功能验证
```

## Step 3: 推送代码

### 3.1 版本号

在 `package.json` 中 bump 版本号：

| 变更类型 | 版本号升级 | 示例 |
|---------|-----------|------|
| Bug fix | patch (x.y.Z) | 1.2.0 → 1.2.1 |
| 新功能（向后兼容） | minor (x.Y.0) | 1.2.0 → 1.3.0 |
| 破坏性变更 | major (X.0.0) | 1.2.0 → 2.0.0 |

### 3.2 提交

遵循 Conventional Commits 格式，commit message 中关联 issue：

```bash
git add <specific-files>
git commit -m "fix: clean dist before build to prevent stale JSX-in-JS files

Fixes #2

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

Types: `feat`（新功能）, `fix`（修复）, `chore`（维护）, `docs`（文档）

### 3.3 推送

```bash
git push
```

## Step 4: 发布 npm 包

> **注意：** npm publish 需要 Touch ID 验证，Claude 无法自动完成。请在完成构建和 dry-run 检查后，由开发者手动执行发布。

```bash
cd packages/<package>

# 构建
npm run build

# 检查产物
npm pack --dry-run

# 发布（需要 Touch ID 验证，手动执行）
npm publish

# 验证发布成功
npm view <package-name> versions --json
```

## Step 5: 回复并关闭 Issue

### 5.1 先回复 issue

在 issue 下发表评论，说明修复情况：

```bash
gh issue comment <number> --body "Fixed in <commit-hash>.

<简要说明修复内容和根因>

Published as <package>@<version>."
```

评论内容应包含：
- 修复的 commit hash
- 问题的根因分析
- 修复方式说明
- 发布的新版本号

### 5.2 再关闭 issue

确认回复后再关闭：

```bash
gh issue close <number>
```

## Step 6: 更新文档

根据变更内容更新对应文档：

| 变更范围 | 需要更新的文档 |
|---------|--------------|
| SDK 类型/API 变更 | `packages/sdk/GAME_DEV_GUIDE.md` |
| 用户可感知的功能变更 | `README.md`（仓库根目录） |
| 新增 CLI 命令或参数 | `README.md` + `GAME_DEV_GUIDE.md` |

更新后提交并推送：

```bash
git add <doc-files>
git commit -m "docs: update documentation for <feature/fix>"
git push
```

npm 包的文档（npm registry 页面）会在 `npm publish` 时自动从包内的 README.md 同步，无需额外操作。
