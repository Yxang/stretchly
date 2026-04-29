# Hotfix worktree git restore incident + AC brief defect + 4 LESSONS v1.23 candidates

- **编号**：019
- **时间**：2026-04-24 12:26 — 已持续到 PQ 第二轮反馈
- **阶段**：事故 + 后续约束 + 第二次违规
- **涉及角色**：architect-2, dev-hotfix-ac15.7, tech-qa-hotfix-ac15.7, Coordinator, product-qa

## 发生了什么

Hotfix worktree（`worktrees/hotfix-ac15.7`，分支 `hotfix/ac15.7-tier-threshold-order`，dev HEAD 7c35e65）刚 spawn 2 分钟后，architect-2 执行 `git restore` 操作，破坏性清除了 dev-hotfix 正在进行的未提交改动：
- `app/locales/en.json`：i18n 键 `quota.preferences.errors.tierOrder` 丢失
- `app/utils/quotaManager.js`：方法实现完整，未受影响（git restore 只作用未 stage 文件）

Reflog 留痕：`7c35e65 HEAD@{0}: reset: moving to HEAD`

## 根因分析

**事件时间线**：
1. **12:23** Coordinator 创建 hotfix worktree + spawn dev-hotfix-ac15.7、tech-qa-hotfix-ac15.7
2. **12:26** architect-2 扫描 worktree 目录，误判 dev-hotfix 修改为"前一轮 phantom agent 清理的残留"
3. **12:26** architect-2 未核实 agent 活跃状态，直接执行 `git restore --staged && git restore .`
4. **~12:27** Coordinator 通过 `git reflog` + `git status` 取证发现异常
5. **12:28** Coordinator ping architect-2 确认
6. **12:29** architect-2 完整归因 + 承认错误 + 主动提出后续约束

**根本原因**：
- 架构师将"前一轮处理 phantom agent"的上下文错误映射到刚新建的 worktree
- 未识别 agent 活跃状态（任务未完成 = agent 仍在工作）
- 未与 Coordinator 核对 worktree 所有权即动手

## 止血 + 恢复

- **Tech-QA 桩保留**：`test/quotaManager.js` +144 行（8 场景）完整保留，staged 状态已推送
- **Dev 补救**：Coordinator 通知 dev-hotfix-ac15.7 补回 `en.json` 遗漏键 `quota.preferences.errors.tierOrder`
- **无代码丢失**：通过 reflog 可恢复完整状态，dev-hotfix 重新提交无延误

## 后续约束（v1.23 LESSONS 候选）

Coordinator 裁定，架构师对活跃 per-task agent 的 worktree **只读不写**：

```
允许（只读）：git status / git log / git diff / git show
禁止（写入）：git restore / git reset / git checkout / git stash / git rm

必须前置核对：
- 与 Coordinator 确认 worktree 所有权
- 确认 agent 任务状态（活跃 vs 关闭）
- 确认是否有未提交改动（git status 检查）
```

## 错误处置姿态评估

Coordinator 决策：**不升级追责**

理由：
- 架构师诚实完整归因，无甩锅
- 及时主动止血，无进一步破坏
- 明确接受后续约束，无重复风险
- 事故在流程设计阶段可预防（this is on Coordinator/system, not architect-2 personally）

**这正确示范了工程文化中如何对待"聪明人的愚蠢错误"**：快速归因 + 明确改进 = 学习而非惩罚。

## LESSONS v1.23 候选汇总

Checkpoint 阶段评审四条候选是否全部提升：

1. **TaskCreate 预录 pending 任务**（dev-log 016）
   - 规则：owner=null 时必须设 blockedBy，否则 per-task agent 自动认领绕过 Leader 分配
   - 权限类型：流程管制

2. **Eslint scope 隔离**（dev-log 017）
   - 规则：eslint config scope 包含共享目录时，worktree 间 lint 污染导致相互阻塞；pre-commit hook 应限制到当前 worktree changed files，或独立维护 .eslintignore
   - 权限类型：工具约束

3. **架构师 worktree 读写权限**（本条目 · 第一次违规）
   - 规则：架构师对活跃 per-task agent worktree 只读不写；写入前必须与 Coordinator 核对所有权 + agent 活跃状态
   - 权限类型：角色权限

4. **架构师 brief 必须核对 AC 原文**（本条目 · 第二次违规）
   - 规则：spawn per-task agent 的 brief 必须引用 AC / PLANNING 原文校验，不凭印象；brief 每项要求标明出处（文件:行号）
   - 权限类型：流程管制 + 质量控制

## 续记：AC 15.7 hotfix brief 缺陷（第二次违规）

**时间线延伸**：PQ 第二轮发现实现策略偏离 AC 15.7 原期望。

### 问题描述

Hotfix 实现策略：**反序回退 defaults 70/30/10**（当用户设置的 greenThreshold 异序时，强制恢复默认值）

AC 15.7 原期望：**公式连锁下调保留用户 Yellow**（当反序时，保持 yellowThreshold，orangeThreshold 和 orangeThreshold 级联下调以维持相对顺序）

**根本原因**：architect-2 spawn hotfix 时未核对 ACCEPTANCE.md:457 原文，凭印象定义了实现策略。

### 架构师违规评估

这是 architect-2 **同日第二次违规**：
1. **第一次**（12:26）：git restore 破坏性操作 → 归因、止血、约束明确
2. **第二次**（后续）：brief 未核对 AC 原文 → 导致 hotfix 分支 4 commits 实现错误

**处置**（Coordinator 裁定）：
- 不升级追责（self-correction + 主动提议规则，无产品损失）
- 当前 hotfix 分支 4 commits 作废，dev + tech-qa 按新 brief 重做
- 架构师近期 spawn 新任务前必须 Read 相关 AC / PLANNING / 宪法原文
- 新规则入 LESSONS v1.23 候选

### 新规则建议

```
架构师 spawn per-task agent 的 brief 必须引用 AC 原文 / PLANNING 原文校验，
不得凭印象 brief；brief 里每项要求标明出处（文件:行号）。

示例：
  ✗ "实现反序回退"（凭印象）
  ✓ "实现公式连锁下调保留用户 Yellow（ACCEPTANCE.md:457 原文）"
```

## 里程碑

两起事故（破坏性操作 + brief 缺陷）同日发生、同源于架构师流程规范缺失。两次都被快速发现、快速止血、建立明确约束。Dev-log 数据完整记录供版本回顾和工程文化反思。
