# Knowledge Index

> 项目级经验库索引。按 Tags 定位相关条目，按需加载。
> 每条一行，保持简洁。
>
> **加载策略**：按 `Importance`（1-5）× `Updated` 距今天数的倒数排序，`Superseded` 非空的条目跳过不加载；聚焦单模块任务取 top-5，跨模块/架构类任务取 top-10。

## 代码与架构

| File | Tags | Summary | Source | Updated | Importance | Last Referenced | Superseded |
|------|------|---------|--------|---------|------------|-----------------|------------|
| code-quota-manager.md | `scheduling` `state-machine` `electron-store` | QuotaManager 结构：tier/quota 持久化 + tick 驱动 + sanitize 保底 | 版本事件 v1.21 | 2026-04-24 | 4 | — | — |

## 设计决策

| File | Tags | Summary | Source | Updated | Importance | Last Referenced | Superseded |
|------|------|---------|--------|---------|------------|-----------------|------------|
| design-tier-sanitize-strategy.md | `quota` `sanitize` `user-input` | 路径 B γ：非有限/≤0 → 全组 reset；逆序 → cascade clamp | 版本事件 v1.21 AC 15.7 | 2026-04-24 | 5 | — | — |

## 协议与接口

| File | Tags | Summary | Source | Updated | Importance | Last Referenced | Superseded |
|------|------|---------|--------|---------|------------|-----------------|------------|

## 产品经验

| File | Tags | Summary | Source | Updated | Importance | Last Referenced | Superseded |
|------|------|---------|--------|---------|------------|-----------------|------------|
| product-quota-mode.md | `quota` `scheduling` `product` `onboarding` `ux` | Quota Mode 产品定位：配额驱动 vs 时间驱动、四档位机制、适用场景 | 版本事件 v1.21 | 2026-04-25 | 4 | — | — |

## 测试经验

| File | Tags | Summary | Source | Updated | Importance | Last Referenced | Superseded |
|------|------|---------|--------|---------|------------|-----------------|------------|
| tech-qa-post-cleanup-evidence-flow.md | `qa` `worktree` `process` `git-workflow` | Tech-QA worktree 清理后补充证据的正确流程：不直推 dev，改为 dev-log 体系补充 | 版本事件 v1.22 dev-log 041 | 2026-05-07 | 4 | — | — |
