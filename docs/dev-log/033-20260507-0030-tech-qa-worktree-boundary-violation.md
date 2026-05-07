# tech-qa worktree 边界违规事件

- **编号**：033
- **时间**：2026-05-07 00:30
- **阶段**：治理/流程修正
- **涉及角色**：tech-qa-t202、architect

## 发生了什么

tech-qa-t202 在执行 T-202 headed 验证时，在主仓库 `/Users/yxang/GitMine/stretchly` 而非指定 worktree `worktrees/T202/` 内进行操作，违反 git-workflow.md 强制规则。

规则条款：「禁止 cd 到主仓库...在非自己 worktree 的目录中执行任何 git 或文件操作」

## 残留物（架构师审计发现）

主仓库污染：
- `app/soft-reminder-renderer.js` — 出现与 T-202 分支同款修改（无功能风险，但违反隔离原则）
- `qa-soft-reminder-capture.mjs`、`test-soft-reminder-screenshot.mjs` — 临时验证脚本
- `docs/dev-log/screenshots/T202-{before,after}.png` — 截图归档在主仓库而非 worktree

## 根因分析

spawn prompt 未明确禁止 tech-qa 在主仓库做 headed 验证。虽然隐含要求 worktree 隔离，但未强调。
tech-qa-t202 可能误以为 ELECTRON_OVERRIDE_DIST_PATH env 必须在主仓库使用，导致选择主仓库执行。

## 已采取的纠正

1. tech-qa-t202 revert 主仓库污染 + 删除临时脚本
2. 删除主仓库 `docs/dev-log/screenshots/T202-{before,after}.png`
3. dev-t202 在 T-202 分支 commit 截图后 force-push
4. tech-qa-t203 自查同款问题（未发现）
5. 加固未来 tech-qa spawn prompt：
   - 明确：headed 验证只能在被分配 worktree 内执行
   - 明确：截图必须 commit 到对应任务分支
   - 明确：ELECTRON_OVERRIDE_DIST_PATH 是全局 env，不需主仓库操作

## 影响评估

**未阻塞**：T-202/T-203 merge 内容正确，分支内容无问题。
**风险等级**：低（污染内容无功能影响，已全部清理）
**流程改进**：spawn prompt 加固，预防 Batch 2+ 重复

## 教训

git-workflow.md 强制规则需在团队培训时显式强调，而非隐含假设。worktree 隔离不可松懈，即使有全局 env 配置也要严格隔离执行环境。
