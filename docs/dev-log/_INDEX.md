# 开发日志索引

> 追溯式开发事件流水账。每个重要事件一个文件，按时间序号排列。

## 条目

### 2026-04-21

- [001-20260421-1500-chronicler-setup.md](001-20260421-1500-chronicler-setup.md) — 追溯员系统初始化，建立 CHRONICLE.md 和 dev-log 体系
- [002-20260421-1501-T006-cr-pass.md](002-20260421-1501-T006-cr-pass.md) — T006 代码审查通过（软提醒窗口，2 轮 CR）
- [003-20260421-1502-T001-cr-pass.md](003-20260421-1502-T001-cr-pass.md) — T001 代码审查通过（defaultSettings，2 轮 CR，架构师裁定字段名）
- [004-20260421-1503-T006-cr-complete.md](004-20260421-1503-T006-cr-complete.md) — T006 CR 完成（架构师直复审，扩展 IF-4 契约，CR 代码鲜度问题教训）
- [005-20260421-1504-T011-cr-pass.md](005-20260421-1504-T011-cr-pass.md) — T011 代码审查通过（英文 i18n，51 条新 key，1 轮直通）
- [006-20260421-1505-T001-cr-pass-final.md](006-20260421-1505-T001-cr-pass-final.md) — T001 CR 通过（发现文档同步疏漏、字段命名冲突，PL 更新 ACCEPTANCE v1.3）
- [007-20260421-1506-T011-cr-pass-merge.md](007-20260421-1506-T011-cr-pass-merge.md) — T011 CR 通过 + 合并到 dev（51 条 i18n key，Phase 迭代过程）
- [008-20260421-1507-T006-qa-pass.md](008-20260421-1507-T006-qa-pass.md) — T006 技术 QA 通过（32/32 测试，所有验收点通过）

### 2026-04-24

- [009-20260424-1234-T009-merged.md](009-20260424-1234-T009-merged.md) — T009 合并到 dev（rebase + squash，无冲突，merge commit 8527599）
- [010-20260424-1820-T002-merged.md](010-20260424-1820-T002-merged.md) — T002/T003 合并到 dev（QuotaManager 核心 + 测试桩，3 轮 CR 通过，64/64 测试，merge commit 74f59da）
- [011-20260424-1850-T004-T005-merged.md](011-20260424-1850-T004-T005-merged.md) — T004/T005 合并到 dev（BreaksPlanner quota 模式 + 测试桩，1 轮 CR 通过，41/41 planner + 368 全量测试，merge commit 3b74c67）
- [012-20260424-1900-T012-merged.md](012-20260424-1900-T012-merged.md) — T012 合并到 dev（红档推迟 2× 扣费提示，1 轮 CR 通过，368/368 测试，merge commit 01e9a09）
- [013-20260424-1930-T007-merged.md](013-20260424-1930-T007-merged.md) — T007 合并到 dev（main.js 软提醒集成，1 轮 CR 通过，368/368 测试，修复 4 项继承 bug，merge commit 14f47f4）
- [014-20260424-1945-Batch5-spawn.md](014-20260424-1945-Batch5-spawn.md) — Batch 5 启动（T008 托盘可视化 + T010 命令快捷键并行，worktree 就位，基于 dev HEAD 14f47f4）
- [015-20260424-1950-AC-decisions.md](015-20260424-1950-AC-decisions.md) — 架构师决策：AC 15.7 hotfix 批准（tier 阈值约束检查）+ v1.22 backlog（soft-reminder 硬编码阈值推迟）
- [016-20260424-1955-TaskList-auto-claim-incident.md](016-20260424-1955-TaskList-auto-claim-incident.md) — 流程事件：per-task agent 自动认领 TaskList pending 任务事件 + 缓解方案（blockedBy 约束 + LESSONS.md 候选）
- [017-20260424-2000-T008-merged.md](017-20260424-2000-T008-merged.md) — T008 合并到 dev（托盘 quota 可视化，3 轮 CR + 架构师 mechanical fix，lint 污染事件教训，merge commit 12504bd）
- [018-20260424-2005-T010-merged.md](018-20260424-2005-T010-merged.md) — T010 合并到 dev（命令与快捷键，rebase 后 CR 1 轮通过，368/368 测试，merge commit 7c35e65）
- [019-20260424-1226-git-restore-incident.md](019-20260424-1226-git-restore-incident.md) — hotfix 同日双违规事件：git restore 误伤 + AC brief 缺陷 + 4 条 LESSONS v1.23 候选（流程管制 2 条 / 工具约束 1 条 / 角色权限 1 条）
- [020-20260424-1241-AC15.7-PathB-brief.md](020-20260424-1241-AC15.7-PathB-brief.md) — AC 15.7 hotfix Path B 汇总 brief 备案版（公式、验收标准表、工作范围、CR 条件、LESSONS 第 5 条）
- [021-20260424-1420-hotfix-ac15.7-qa-pass.md](021-20260424-1420-hotfix-ac15.7-qa-pass.md) — AC 15.7 hotfix 技术 QA 流水账（72/72 tests fd2f1e4 暂缓结案，最终验证待 Leader rerun，memo 归档失败历史 + 策略三次变动）
- [022-20260424-1300-hotfix-ac15.7-pathB-gamma-merged.md](022-20260424-1300-hotfix-ac15.7-pathB-gamma-merged.md) — AC 15.7 hotfix 完整迭代轨：Path A β 作废 → Path B γ-locked 合并（12 步事实轨 + 规格演化 + 12 条 LESSONS v1.23 候选，merge commit 8ce7a0a）
- [023-20260424-1500-Phase6-closeout-start.md](023-20260424-1500-Phase6-closeout-start.md) — Phase 6 Close-out 启动：PQ 第一轮通过 + 三路并行评审（技术 zone 9 条 + 产品 zone 3 条 LESSONS + CONSTITUTION/knowledge 检查）
