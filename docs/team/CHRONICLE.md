# 记录册 — Stretchly v1.21

## 作者：追溯员
## 最后更新：2026-04-24

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
| 2026-04-21 | T001 | developer-T001 | code-reviewer-T001 | 通过 | 2 轮 CR；第 1 轮拒绝（softReminderAutoDismissMs 缺失、字段名冲突），架构师裁定保留 longBreakHardDeadlineMs，第 2 轮通过（47/47 测试绿）；commit b09f02c；发现文档同步疏漏（IF-3 漏补、PLANNING/ACCEPTANCE 命名冲突），PL 更新 ACCEPTANCE v1.3 |
| 2026-04-21 | T006 | developer-T006 | code-reviewer-T006 | 通过 | 2 轮 CR；第 1 轮拒绝均基于过期代码（CR 代码鲜度问题），架构师直复审批准扩展 IF-4（新增 autoClose action），第 2 轮核查通过；commit 5e08165 |
| 2026-04-21 | T011 | developer-T011 | code-reviewer-T011 | 通过 | 1 轮 CR，直接通过；51 条 quota 新 key（Phase 1预估42→架构师补齐11→Phase 2定稿51），JSON 有效；squash merge 到 dev 中 |

### 测试结果

| 日期 | 任务 | QA | 运行数 | 通过 | 失败 | 备注 |
|------|------|----|-------|------|------|------|
| 2026-04-21 | T006 | tech-qa-T006 | 32 | 32 | 0 | 静态源码分析；contextBridge API/CSS 动效/i18n/防抖/键盘交互/autoClose 路径分离均通过；commit 060258a |
| 2026-04-24 | AC 15.7 hotfix | tech-qa-hotfix-ac15.7 | 72 | 72 | 0 | _sanitizeTierThresholds 级联公式；8 新测试 + 64 继承测试；commit fd2f1e4；memo 记录失败历史 + 策略三次变动 |

### 合并到 dev

| 日期 | 分支 | 作者 | 审查者 | 描述 |
|------|------|------|--------|------|
| 2026-04-21 | feat/T011/i18n-english | developer-T011 | merger-T011 | squash merge；51 条 quota.* i18n key（app/locales/en.json）；T011 completed |
| 2026-04-24 | feat/T009/preferences-ui | developer-T009 | merger-T009 | squash merge；preferences UI quota 模式；merge commit 8527599；T009 completed |
| 2026-04-24 | feat/T002/quota-manager | developer-T002 | merger-T002 | squash merge；QuotaManager 核心（512 行）+ 测试桩（701 行）；merge commit 74f59da；T002/T003 completed |
| 2026-04-24 | feat/T004/planner-quota-mode | developer-T004 | merger-T004 | squash merge；BreaksPlanner quota 模式（+374 行）+ 测试（726 行）；merge commit 3b74c67；T004/T005 completed |
| 2026-04-24 | feat/T012/red-tier-postpone-cost | developer-T012 | merger-T012 | squash merge；红档推迟 2× 扣费提示（67 行）；merge commit 01e9a09；T012 completed |
| 2026-04-24 | feat/T007/main-soft-reminder-integration | developer-T007 | merger-T007 | squash merge；main.js 软提醒集成 + powerMonitor 钩子（300+ 行）；修复 4 项继承 bug（悬空 listener / i18n 缺失 / 双路 postpone / T011 漏键）；merge commit 14f47f4；T007 completed |
| 2026-04-24 | feat/T008/tray-quota-visualization | developer-T008 | merger-T008 | squash merge；托盘图标动态变色（4 tier）+ 两行 tooltip；3 轮 CR（含架构师 mechanical fix 4777269）；lint 污染教训（T010 跨任务阻塞）；merge commit 12504bd；T008 completed |
| 2026-04-24 | feat/T010/commands-shortcuts | developer-T010 | merger-T010 | squash merge；resetQuota 命令 + 快捷键（Ctrl/Cmd+Shift+Q）；rebase origin/dev 后 CR 1 轮通过；merge commit 7c35e65；T010 completed |
| 2026-04-24 | hotfix/ac15.7-tier-threshold-order | developer-hotfix-ac15.7 | merger-hotfix-ac15.7 | squash merge；AC 15.7 hotfix Path B γ-locked 完整迭代（Path A β 作废 → Path B γ 合并）；12 步完整事实轨；73/73 canonical tests；merge commit 8ce7a0a；hotfix completed；12 条 LESSONS v1.23 候选（dev-log 022） |

---

## 发现的问题

| 日期 | 发现者 | 描述 | 严重程度 | 在范围内 | 处理方式 | 状态 |
|------|--------|------|---------|---------|---------|------|
| 2026-04-24 | Coordinator | Hotfix worktree git restore 误伤：architect-2 误判 en.json + quotaManager.js 修改为 phantom 残留，执行破坏性 git restore | 重要 | 是 | Dev-hotfix 补回 quota.preferences.errors.tierOrder；通过 reflog 可完整恢复；后续约束"架构师对活跃 worktree 只读不写" | 已止血，dev-hotfix 补救中 |

---

## 决策日志

| 日期 | 决策 | 决策者 | 权限类型 | 理由 | 影响范围 |
|------|------|--------|---------|------|---------|
| 2026-04-21 | 扩展 IF-4 契约：软提醒新增第 4 个 action `'autoClose'` | 架构师 | 技术 | T006 开发完成后，发现漏列 IF-4，需补充合约 | T007、T012 后续依赖此扩展 |
| 2026-04-24 | AC 15.7 hotfix 批准：quotaManager._computeTier() 阈值反序约束 | 架构师 | 技术 | 发现阈值反序时 tier 判定失效；创建 hotfix/ac15.7-tier-threshold-order，排队 T008 merge 后 spawn | quotaManager.js、preferences-renderer.js、test/quotaManager.js |
| 2026-04-24 | v1.22 backlog 决策：soft-reminder-renderer 硬编码阈值 70/30/10 | 架构师 | 技术 | 硬编码不跟随 settings；修复复杂度中等，优先级低于 T008/T010；推迟到 v1.23 | soft-reminder-renderer.getTierClass()；v1.23+ backlog |
| 2026-04-24 | 架构师同日双违规 + Coordinator 裁定（不升级追责 + 建立约束） | Coordinator | 流程/角色 | (1) git restore 破坏性操作；(2) AC brief 凭印象未核对原文 → hotfix 实现策略偏离 AC 期望；两次都诚实归因 + 主动止血 + 明确约束，无产生品损失 | 4 条 LESSONS v1.23 候选（TaskCreate owner / eslint scope / 架构师 worktree 权限 / brief 原文核对） |

---

## 被拒绝/返工项（简要）

| 日期 | 任务 | 被谁拒绝 | 原因（一行） | 返工分配给 |
|------|------|---------|-------------|-----------|
| | | | | |

---

## Phase 6 Close-out（2026-04-24）

### PQ 第一轮结果

| 验收项 | 状态 | 备注 |
|--------|------|------|
| 47 AC 功能点 | 全通过 | quota-scheduling feature complete |
| AC 15.6 补充验证 | 全通过 | 前期 Batch 后验 |
| AC 15.7 hotfix | 全通过 | Path B γ-locked merge commit 8ce7a0a |
| 404/404 全项目测试 | pass | 继承测试无返工 |
| ACCEPTANCE.md:457 修订 | 完成 | AC 15.7 原文确认 |

### LESSONS v1.23 评审结果

**技术区**（8 条接受）：
- 持久化字段语义约束与 UI 校验
- 规格多轮变更后字面执行 vs 结论验证
- Batch 合并后 shutdown sweep
- Per-task agent 关闭时机 = 任务结束
- Per-task agent SHA 汇报精度（`git rev-parse HEAD`）
- Worktree lint scope 限定（--root 或 .standardignore 迁移）
- TaskCreate owner + blockedBy 预锁
- Agent self-report green 需 Leader rerun

**产品区**（2 条接受）：
- PL 规格定稿前逐行算法验证
- 规格变更经 Coordinator 统一路由

**审核统计**：
- 12 条候选 → 10 条接受 + 2 条退场（#3 合并到 #7、#4 拒绝）+ 1 条弃权（#10 L4 选 B）

### CONSTITUTION 检查

- **审查结果**：无修订
- **持续有效**：v1.21 CONSTITUTION 继承到 v1.22

### Knowledge 增补

- `docs/knowledge/code-quota-manager.md`（Importance 4）：quotaManager 实现要点
- `docs/knowledge/design-tier-sanitize-strategy.md`（Importance 5）：tier 级联调整公式 + X/Y 锁定经验
- `docs/knowledge/_INDEX.md`（新建）：知识库索引

### 用户自测遗留（#7/#9）

- **L4 选择**：选 B（Phase 7 用户自测清单）
- **后续**：Coordinator 在 close-out 结束时提示用户
- **时机**：不阻塞 v1.22 发布

### Stray Agent 事件记录

| 日期 | Agent | 来源 | 状况 | 处置 |
|------|-------|------|------|------|
| 2026-04-24 | dev-T008 | 前代 architect-1 遗留 | 未响应 | Coordinator 代劳 shutdown |
| 2026-04-24 | product-qa-1, product-qa-2 | 本 session PL team 遗留 | 未响应 | Coordinator 代劳 shutdown |

**教训**：验证 LESSONS #11/#12 设计的必要性（per-task agent 生命周期管理 + shutdown 时机精确性）。

---

## API 文档

*追溯员在每次影响接口的代码变更通过后更新。*

### [模块/服务名称]

#### [端点/函数 1]

```
[签名、参数、返回类型、使用示例]
```

---

## 成本摘要

*由 Coordinator 在里程碑时更新。*

| 里程碑 | 总 Token | 估计成本 | 最大消耗者 | 备注 |
|--------|---------|---------|-----------|------|
| | | | | |

---

## 团队评估摘要

*由 Coordinator 在里程碑时更新。*

| 成员 | 角色 | 表现 | 建议 |
|------|------|------|------|
| | | | |
