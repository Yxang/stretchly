# 记录册 — Stretchly v1.22

## 作者：追溯员
## 最后更新：2026-05-06

> 本文档是所有已通过工作和重要事件的客观记录。
> 只有追溯员可以写入此文件。其他人：只读。

---

## 产品团队

### 验收标准变更

| 日期 | 变更内容 | 原因 | 决策者 |
|------|---------|------|--------|
| | | | |

### 产品 QA 结果

| 日期 | 功能 | 模式 | 结果 | 发现的问题 | 证据 |
|------|------|------|------|-----------|------|
| | | | | | |

---

## 技术团队

### 代码审查

| 日期 | 任务 | 开发 | 审查者 | 结果 | 备注 |
|------|------|------|--------|------|------|
| 2026-05-06 | T-201 | dev-t201 | cr-t201 | 通过 | 变更最小（app/css/preferences.css 一行），符合 IF-4 契约；AC 1.1 满足；无返工；等 headed 截图验证（AC 1.2/1.3），commit 387fcec |
| 2026-05-06 | T-202 | dev-t202 | cr-t202 | 通过 | i18next 参数对齐（app/soft-reminder-renderer.js 1 行 + test/softReminder.js 反向断言），509/509 PASS，lint PASS，无 AUTO-FIX，commit e098835 |

### 测试结果

| 日期 | 任务 | QA | 运行数 | 通过 | 失败 | 备注 |
|------|------|----|-------|------|------|------|
| 2026-05-06 | T-201 | tech-qa-T201 | 459 | 459 | 0 | CSS 选择器扩展 + computed style CDP 验证 + before/after 截图（commit 1d77455）；lint PASS；AC 1.1/1.2/1.3 all pass；等待 CR |
| 2026-05-07 | T-204 | tech-qa-T204 | 523 | 523 | 0 | :nth-child 选择器 CSS 排版（27 文件，+7 新增回归测试）；文本+日志+静态分析三段式证据；AC 4.1/4.2/4.3 all pass；commit 5ccedd0；等待 CR |

### 合并到 dev

| 日期 | 分支 | 作者 | 审查者 | 描述 |
|------|------|------|--------|------|
| 2026-05-07 | fix/T201/quota-help-css | dev-t201 | merger | squash merge f8bd31f；app/css/preferences.css grid-column 选择器扩展；AC 1.1/1.2/1.3 全过；cleanup f9b359e；branch + worktree 已清理；T-201 completed |
| 2026-05-07 | fix/T202/soft-reminder-i18n | dev-t202 | merger | squash merge a0d05e9；app/soft-reminder-renderer.js { seconds }→{ count: seconds }；test/softReminder.js 4 用例全过；AC 3.1-3.5 全过；流程纠正 dev-log 033 已完成；screenshot commit 529c621 并入；branch + worktree 已清理；T-202 completed |
| 2026-05-07 | fix/T203/planner-mode-hot-reload | dev-t203 | merger | squash merge 025e69c；app/breaksPlanner.js setSchedulingMode emit 契约 IF-1；app/main.js save-setting + schedulingModeChanged listener 契约 IF-2；test 5 ATDD 用例 + 2 静态断言；AC 2.1-2.7 全过；文本+日志+静态分析三段式证据（dev-log 035 agent no-display 方案）；branch + worktree 已清理；Batch 1 completed |

---

## 发现的问题

| 日期 | 发现者 | 描述 | 严重程度 | 在范围内 | 处理方式 | 状态 |
|------|--------|------|---------|---------|---------|------|
| 2026-05-07 | 架构师（审计） | tech-qa-t202 worktree 边界违规：在主仓库执行 headed 验证，造成 app/soft-reminder-renderer.js 污染 + 临时脚本 + 截图归档位置错误 | 中等 | 是 | tech-qa-t202 清理主仓库，dev-t202 force-push 截图到分支，加固 tech-qa spawn prompt 明确 worktree 隔离规则 | 已修正，T-202/T-203 内容无影响 |
| 2026-05-07 | tech-qa-t203（验证）、architect（确认） | 技术约束：Claude Code agent shell 无 display 访问（screencapture exit 1，capturePage 超时），沙盒结构性限制；T-202 截图成功系越权副作用（在主仓库获得 host 终端 display）；无法在 agent 内自动截图，需降级为文本+日志+静态分析证据 | 高 | 否（plan 阶段设计限制） | T-202 option A 不可重复；T-203+ 采用 option B 文本证据；v1.23+ plan §9 改为「证据标准」并声明形式；写入 CONSTITUTION.md | 已适应，v1.22 无影响 |

---

## 决策日志

| 日期 | 决策 | 决策者 | 权限类型 | 理由 | 影响范围 |
|------|------|--------|---------|------|---------|
| 2026-05-06 | Bug 4 选项 3：break-window 不强制关闭，沿用 v1.21 | 架构师 + Product Lead | 产品 | 与产品设计一致，保留用户自主权 | T-204（break-renderer.js、BreaksPlanner） |
| 2026-05-06 | 工具链标准化：screencapture + osascript + capturePage 三轨方案 | 架构师 | 技术 | 覆盖多种 QA 场景；否决 playwright-electron | Tech-QA 截图、dev-log/screenshots/ |
| 2026-05-06 | Bug 2 范围收敛：i18n 移出，保留 CSS 排版修复 | 架构师 | 技术 | grep 验证 0 处硬编码英文，由 CSS 问题引起 | T-203（soft-reminder-renderer.js）工作量 -30% |
| 2026-05-06 | zh-CN L4 gate：不通过直接打回，无 known-issue 豁免 | Product Lead | 产品 | zh-CN 一级支持语言，质量标准不可降级 | Phase 6 PQ 验收、hotfix 决策 |
| 2026-05-06 | F-301 PQ 升级：Electron binary 复用方案 | 架构师 | 运维 | worktree 并行开发时避免 binary 重复下载（600MB × N），通过 ELECTRON_OVERRIDE_DIST_PATH=/Users/yxang/GitMine/stretchly/node_modules/electron/dist 指向主仓库共享副本 | v1.22 全 Batch 1 worktrees；预期避免 5-10 分钟重复下载 |

---

## 被拒绝/返工项（简要）

| 日期 | 任务 | 被谁拒绝 | 原因（一行） | 返工分配给 |
|------|------|---------|-------------|-----------|
| | | | | |

---

## 版本进度

### Phase 3-5 Milestone（2026-05-06）

| 阶段 | 事件 | 状态 |
|------|------|------|
| Phase 3 | PLANNING.md 定稿（10 节，§2 含 4 项偏差 ACK）；ACCEPTANCE.md 定稿（27 AC） | ✓ 完成 |
| Phase 4 | 跳过（沿用 v1.21 固定团队） | ✓ 完成 |
| Phase 5 | TaskList 创建 T-201..T-205；T-204 blockedBy T-201 | ✓ 完成 |

### Batch 1（v1.22 5-bug 修复 + PQ 流程升级）

| 任务 | 功能 | 优先级 | QA 阶段 | 当前状态 | 备注 |
|------|------|--------|---------|---------|------|
| T-201 | Bug 1 CSS：quota help 区竖条排版修复 | P0 | post | ✓ 已合并（f8bd31f） | AC 1.1/1.2/1.3 全过；T-204 now unblocked |
| T-202 | Bug 5 i18next：{ seconds } → { count: seconds } | P0 | atdd | ✓ 已合并（a0d05e9） | AC 3.1-3.5 全过；流程纠正完成（dev-log 033）；T-203 可全力推进 |
| T-203 | Bug 4 planner 热重建 + main.js IPC | P0 | atdd | ✓ 已合并（025e69c） | AC 2.1-2.7 全过；文本+日志+静态分析证据（dev-log 035 方案 B）；Batch 1 完成 |
| T-204 | Bug 2 advanced 区排版（调研型） | P1 | post | 可启动 | T-201 已合并，障碍已清除，可进入开发 |
| T-205 | Bug 3 zh-CN quota.* 补译 ~60 keys | P2 | post | pending | 独立任务，后续启动 |

**Batch 1 总结**（dev-log 037）
- 时间跨度：2026-05-06 18:00 ～ 2026-05-07 01:46（~8h）
- 完成率：3/3（T-201✓ T-202✓ T-203✓）
- AC 通过：15/15（1.1-1.3 + 3.1-3.5 + 2.1-2.7）
- 合并 commits：f8bd31f → a0d05e9 → 025e69c
- 流程发现：worktree 边界违规（dev-log 033）、agent shell no-display（dev-log 035）
- 证据形式演进：方案 A（视觉截图）→ 方案 B（文本+日志+静态分析）

---

## 当前版本信息

- **版本**：v1.22
- **主题**：Quota Mode 功能完善 + 5-bug 修复 + PQ 流程升级
- **启动日期**：2026-05-06
- **最后更新**：2026-05-06 20:02（Phase 3-5 完成）
- **截图归档**：`docs/dev-log/screenshots/T<NNN>-<short>.png`
  - P0 bug 修复必备 before/after 截图（参考 plan §8 第 5 项）
  - Tech-QA headed 测试截图存档于此
- **重要约束**：
  - L4 验收门槛：zh-CN 不通过直接打回，无 known-issue 豁免
  - 工具链：screencapture + osascript + capturePage 三轨方案（否决 playwright-electron）

---
