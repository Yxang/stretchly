# Git 工作流规范

## 概述

本规范定义了 Agent 团队使用 Git Worktree 进行代码隔离协作的工作流。每个任务在独立的 worktree 中工作，通过分支协作。

## Git Worktree — 每个任务独立工作空间

每个 Agent **必须且只能** 在自己专属的 worktree 中工作。**严禁** 在主仓库或其他任务的 worktree 中操作。

### 强制规则

- 你 **只能** 在自己的 worktree 目录下工作
- **禁止** cd 到主仓库或其他任务的 worktree
- **禁止** 在非自己 worktree 的目录中执行任何 git 或文件操作
- 所有 worktree 共享同一个 git 仓库，commit / branch / push 操作对所有 Agent 可见
- **例外**：Code Reviewer 和架构师可以 **只读** 查看其他任务的 worktree

Worktree 创建由架构师执行，详见 `.claude/agents/architect.md`。

## 分支模型

- `main` — 稳定发布分支，仅用户/Owner 可操作
- `dev` — 集成分支，架构师批准合并，merger 执行（特殊情况架构师可直接执行）
- 功能分支 — 每个任务的工作区，完成后经架构师批准 squash merge 到 dev

**永远不要直接 push 到 `main` 或 `dev`。**

## 分支命名

```
feat/T<NNN>/<简短描述>     — 新功能任务
fix/T<NNN>/<简短描述>      — Bug 修复任务
refactor/T<NNN>/<简短描述> — 重构任务
hotfix/<简短描述>          — 紧急修复（产品 QA / 集成冒烟阶段发现的问题）
chore/<简短描述>           — CI/基础设施
docs/<简短描述>            — 纯文档变更
```

## 提交规范

使用 Conventional Commits 格式，小步提交：

```bash
git add <只添加你修改的文件>
git commit -m "<type>(<scope>): <描述>"
```

- type: feat, fix, refactor, test, chore, docs; scope: 模块名
- 描述: 祈使句，英文，小写开头，不加句号。示例：`feat(auth): add JWT token validation`

## 标准工作流

**步骤 1**：在你的 worktree 中工作 — 只修改你负责的文件。

**步骤 2**：推送前确保测试通过（`[项目测试命令]`）。

**步骤 3**：推送：`git push -u origin feat/T<NNN>/<简短描述>`

**步骤 4**：等待 CR 和 QA。Code Reviewer 直接读 worktree 审查；被拒绝则修改后重新提交。

合并由 merger agent 执行，详见 `.claude/agents/merger.md`。

## 合并策略

- 功能分支 → dev：**Squash Merge**（保持 dev 历史干净）
- dev → main：**Merge Commit**（`git merge --no-ff`，保留集成历史）

## Review 机制

**核心原则**：架构师/CR 可随时直接查看任何 worktree 的代码，不需要等到 commit/push。早期反馈比完美代码更重要。

当遇到以下情况，**必须** 主动通知架构师/CR：
- 某段代码需要方向性确认 / 功能模块初步完成请求阶段性 review
- 遇到跨模块接口问题 / 不确定实现方式 — 先问再写，避免返工

## 跨模块依赖变更

架构师修改共享类型定义并合并到 dev 后，各受影响 Agent 执行：

```bash
git fetch origin
git rebase origin/dev  # 解决冲突，适配新接口
git push --force-with-lease
```

## 同步检查点

某任务合并到 dev 后，其他活跃 worktree 可能需要 rebase：

```bash
git stash          # 保存当前工作（如有）
git fetch origin && git rebase origin/dev
[项目测试命令]
git stash pop      # 恢复工作（如有）；如有冲突立即通知架构师
```

## 禁止操作

- 直接 push 到 `main` 或 `dev`
- 使用 `git push --force`（除非架构师明确要求，且使用 `--force-with-lease`）
- 修改其他任务正在工作的文件（除非架构师协调）
- 合并其他分支到你的功能分支（如需同步 dev，用 `git rebase dev`）
- 进入其他任务的 worktree 目录操作（只读查看除外）
