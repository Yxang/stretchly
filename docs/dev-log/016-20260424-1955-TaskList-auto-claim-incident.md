# Per-task agent TaskList auto-claim incident + process fix

- **编号**：016
- **时间**：2026-04-24 19:55
- **阶段**：流程事件 + 缓解
- **涉及角色**：dev-T010, architect-2, task-list system

## 发生了什么

Per-task agent（dev-T010）在 idle 后自主扫描 TaskList，发现 #13（AC 15.7 hotfix）为 pending 状态无 owner，尝试自动认领执行。dev-T010 正确识别违规（未由架构师 Leader 授权 + 文件域不重叠 + 上游依赖未完成），拒绝认领并 ping architect-2 确认。

## 问题根源

TaskCreate 在预录 pending 任务时缺少可见性管制：
- 任务设置 `owner=null` 时，per-task agent 扫 TaskList 认为任务未分配，自动认领
- 未设 `blockedBy` 约束，上游任务完成后 per-task agent 即刻可声称有资格接收
- 规范要求 per-task agent **只能接收 Leader 明确分配**，不能自主认领

**险境**：dev-T010 若未正确拒绝，会跨越任务域（T010 → T013 hotfix，QuotaManager 修改）+ 跨越时序（T008 merge 前提前修改 quotaManager），导致冲突。

## 缓解方案（已执行）

1. **即刻修复**（2026-04-24）：为 #13 AC 15.7 hotfix 追加 `blockedBy=[T008, T010]` 约束
   - T008 merge 后解除第一个阻塞
   - T010 merge 后解除第二个阻塞
   - 任务对 per-task agent 不可见，直到 Leader 明确分配

2. **流程强化提议**（入 LESSONS.md v1.23）：
   ```
   TaskCreate 预录 pending 任务必须同时满足以下条件之一：
   - owner 显式设置为目标 agent（明确分配）
   - blockedBy 设置依赖任务列表（任务对 auto-claim 隐藏）
   - 标记为 planning-only，不在 pending 列表中展示
   
   避免 per-task agent 自动认领绕过 Leader 分配流程。
   ```

## 教训

Per-task agent 通信范围强制隔离（禁止跨任务）的关键在于**任务可见性管制**。TaskList 作为 source of truth，需要 Coordinator 在 TaskCreate 时主动设防。

## 后续追踪

- AC 15.7 hotfix 排队 T008/T010 merge 后由 Coordinator spawn
- LESSONS.md v1.23 候选条目已标记，checkpoint 时推升
