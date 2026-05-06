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

### 2026-05-06

- [024-20260506-1930-v1.22-chronicler-init.md](024-20260506-1930-v1.22-chronicler-init.md) — v1.22 追溯体系初始化：CHRONICLE.md 空白记录册 + dev-log 编号续接 + screenshots/ 目录建立
- [025-20260506-2000-Phase3-planning-acceptance-finalized.md](025-20260506-2000-Phase3-planning-acceptance-finalized.md) — Phase 3 评估完成：PLANNING.md 定稿（10 节，§2 含 4 项偏差 ACK）、ACCEPTANCE.md 定稿（27 AC，L1-4 分级）
- [026-20260506-2001-Phase5-tasklist-created.md](026-20260506-2001-Phase5-tasklist-created.md) — Phase 5 完成：TaskList 创建 T-201..T-205，T-204 blockedBy T-201（Bug 4 热重建依赖 Bug 1 修复）
- [027-20260506-2002-Phase3-4-critical-decisions.md](027-20260506-2002-Phase3-4-critical-decisions.md) — Phase 3-5 关键决策（4 项）：Bug 4 选项 3 沿用 v1.21、工具链三轨方案、Bug 2 范围收敛 CSS、zh-CN L4 gate 严格模式
- [028-20260506-2100-T201-tech-qa-pass.md](028-20260506-2100-T201-tech-qa-pass.md) — T-201 技术 QA 通过（459/459 PASS，lint PASS，before/after 截图 commit 1d77455，准备 CR）
- [029-20260506-2130-T201-cr-pass.md](029-20260506-2130-T201-cr-pass.md) — T-201 代码审查通过（变更最小 app/css/preferences.css 一行，符合 IF-4，AC 1.1 满足，commit 387fcec，等 headed 截图验证）
- [030-20260506-2131-F301-electron-dist-path-decision.md](030-20260506-2131-F301-electron-dist-path-decision.md) — F-301 PQ 升级决策：Electron binary 复用方案（ELECTRON_OVERRIDE_DIST_PATH 避免 worktree 重复下载 600MB binary）
- [031-20260506-2145-T202-cr-pass.md](031-20260506-2145-T202-cr-pass.md) — T-202 代码审查通过（i18next 参数对齐 app/soft-reminder-renderer.js 1 行 + 测试反向断言，509/509 PASS，commit e098835，准备合并）

### 2026-05-07

- [032-20260507-0015-T201-merged.md](032-20260507-0015-T201-merged.md) — T-201 squash merge 到 dev（f8bd31f，app/css/preferences.css grid-column 选择器扩展，AC 1.1/1.2/1.3 全过，cleanup f9b359e，branch 及 worktree 已清理，T-204 now unblocked）
- [033-20260507-0030-tech-qa-worktree-boundary-violation.md](033-20260507-0030-tech-qa-worktree-boundary-violation.md) — 治理：tech-qa-t202 worktree 边界违规事件（在主仓库执行 headed，造成污染），已修正，spawn prompt 加固 worktree 隔离规则，T-202/T-203 内容无影响
- [034-20260507-0045-T202-merged.md](034-20260507-0045-T202-merged.md) — T-202 squash merge 到 dev（a0d05e9，app/soft-reminder-renderer.js count 参数对齐，test/softReminder.js 4 用例全过，AC 3.1-3.5 全过，流程纠正完成 dev-log 033，screenshot 529c621 并入，branch 及 worktree 已清理，Batch 1 progress T-201✓ T-202✓）
- [035-20260507-0100-agent-shell-no-display-limitation.md](035-20260507-0100-agent-shell-no-display-limitation.md) — 技术约束发现：Claude Code agent shell 无 display 访问（screencapture/capturePage 均失败），沙盒结构性限制；T-202 截图成功系越权副作用；降级为文本+日志+静态分析证据；v1.23+ plan 需改为「证据标准」并前置声明；无视觉截图能力非 bug 而是架构约束
- [036-20260507-0146-T203-merged.md](036-20260507-0146-T203-merged.md) — T-203 squash merge 到 dev（025e69c，app/breaksPlanner.js IF-1 emit 契约，app/main.js IF-2 handler+listener，test 5 ATDD + 2 静态断言，AC 2.1-2.7 全过，文本+日志+静态分析三段式证据方案 B，branch 及 worktree 已清理）
- [037-20260507-0147-batch1-close-out.md](037-20260507-0147-batch1-close-out.md) — Batch 1 Close-out：3 任务 8 小时完成（2026-05-06 18:00～01:46），15/15 AC 全过，f8bd31f→a0d05e9→025e69c，worktree 违规＋no-display 约束发现闭环，证据形式演进方案 A→B，team 并行流程成熟度确认
