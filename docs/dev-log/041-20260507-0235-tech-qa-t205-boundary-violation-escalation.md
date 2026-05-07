# 治理：tech-qa-t205 worktree 边界违规（升级）

- **编号**：041
- **时间**：2026-05-07 02:35
- **阶段**：治理/流程修正
- **涉及角色**：tech-qa-t205、architect

## 事件性质

第二次 worktree 边界违规（cf. dev-log 033），但**升级为更严重的形式**。

**dev-log 033**（tech-qa-t202）：
- 在主仓库写文件（污染 app/soft-reminder-renderer.js）
- 但没有 commit 到版本控制

**dev-log 041**（tech-qa-t205）：
- 不仅在主仓库写文件
- **直接 commit 到 dev 分支**（268e493）
- 违反 git-workflow.md 第 27 行：「永远不要直接 push 到 main 或 dev」

## 违规细节

### 发生的事

tech-qa-t205 在主仓库 worktree 内执行某操作，产生了文件变更，随后直接在 dev 分支执行 git commit。

### 证据

- 非法 commit hash：268e493（不在设计中的 dev 历史）
- commit 消息：（待查证具体内容）
- 时间：2026-05-07 02:20 前后（Batch 2 合并前夜）

## 缓解行动

**立即止血**：tech-qa-t205 执行 git revert 3f921cd，撤销 268e493 的变更。

**最终状态**：
- 功能层面：clean（文件状态净差异 = 0）
- 历史层面：污染（dev 多 2 条 commit 噪声：268e493 + 3f921cd 的 revert）
- **影响范围**：无（Batch 2 合并内容不涉及被污染的变更）

## 根因分析

**直接原因**：
- spawn prompt 仍未强制 tech-qa 必须在 worktree 内操作
- git-workflow.md 规则未纳入 agent prompt 的硬要求

**根本原因**：
- dev-log 033 修正后（加固 spawn prompt 强调 worktree 隔离），但仅强调「文件操作」隔离
- 未同时强调「git 命令」隔离（commit/push 必须只在 task 分支，不能直接 commit 到 dev/main）
- tech-qa agent 没有「git status 检查」的预控步骤

## 改进建议（arch 待评估）

### 1. Enforce-worktree-boundary Hook 升级

当前：阻止 per-task agent 在主仓库生成新文件

升级：也阻止 per-task agent 在主仓库 worktree 的目录中执行 **任何写操作**（包括编辑、删除、符号链接等）

### 2. PreToolUse Hook 阻止主分支 commit

新增 hook：在 tech-qa/dev/cr agent 调用 git commit 前检查：
- 当前分支是否为 dev/main？
  - 是 → 拒绝执行，返回「per-task agents 禁止 commit 到 dev/main，必须在 task 分支工作」
  - 否 → 允许继续

### 3. Tech-QA Agent Prompt 强化

spawn prompt 增加硬要求（紫色 🚫 标记）：
```
🚫 在执行任何 git 操作前，必须：
1. 执行 git status，验证 cwd 在 worktrees/T<NNN>/ 中
2. 验证当前分支为 fix/T<NNN>/...（非 dev/main）
3. 若不符合，立即 cd 到正确 worktree 或请求 Coordinator 协助

违反此规则的任何 git commit 会被视为严重违规，可能导致 agent 降权。
```

## 教训

1. **多层级隔离**：文件隔离 ≠ git 隔离。两者都是强制规则。
2. **agent 自检**：不能依赖 hook，agent 自身需要「当前位置/分支检查」的预控。
3. **规则递阶**：dev-log 033 修正了「文件隔离」，但遗漏了「git 隔离」，导致 041 升级。

## Pattern Note

🔁 隔离规则的演进：从 worktree 文件隔离（033）→ git 分支隔离（041）。说明隐性约束的逐层暴露。应在 CONSTITUTION.md 明确「per-task agent 的三层隔离约束」（工作目录 + 文件操作 + git 分支）。
