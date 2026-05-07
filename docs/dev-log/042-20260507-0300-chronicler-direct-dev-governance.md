# 治理：Chronicler 直推 dev 的规则-实践不一致

- **编号**：042
- **时间**：2026-05-07 03:00
- **阶段**：治理/元观察
- **涉及角色**：chronicler、architect

## 事件性质

v1.22 全程完成后的「自指性」governance 发现：chronicler 刚编码的「不直推 dev」规则（knowledge/tech-qa-post-cleanup-evidence-flow.md），与 chronicler 自身的工作流实践产生了冲突。

## 问题陈述

### 规则与实践的矛盾

**规则**（knowledge/tech-qa-post-cleanup-evidence-flow.md）：
```
❌ 错误做法：直接推送到 dev 分支
✓ 正确做法：把补充内容发给 chronicler，由 chronicler 在 dev-log 中追加
```

**实践**（Batch 1 + Batch 2 实际工作流）：
- 04db37f：CHRONICLE.md + dev-log 索引（直推本地 dev）
- a61a610：knowledge 条目（直推本地 dev）
- f4cd5af、a4f9ec1、1c2272b、36a11e9：Batch 1 chronicler commits（全部直推本地 dev）

**pattern 已确立**：chronicler 历史上 100% 直推，不走 worktree/PR 流程

### 差异分析

| 维度 | Tech-QA 违规（dev-log 041） | Chronicler 标准（Batch 1/2） |
|------|---------------------------|--------------------------|
| 操作目标 | 功能代码 + 配置（268e493） | 纯文档变更（CHRONICLE/dev-log） |
| 危害等级 | 高（功能污染 + git 历史） | 低（无代码影响） |
| 历史模式 | 首次违规 | 4+ commits 确立的模式 |
| 规则遵从 | 明显违反 git-workflow.md §27 | 规则本身存在隐性例外 |

## 根因分析

**直接原因**：knowledge 文档编码规则时，未考虑 chronicler 自身的工作流现状

**根本原因**：git-workflow.md 对「谁可直推 dev」的定义不明确：
- 文本上：「只有架构师和 merger」
- 实践上：chronicler 也直推（隐性例外）
- 规则缺陷：没有明确说"per-task agent"vs"角色"的区别

## 治理选项（架构师待裁定）

| 选项 | 做法 | 优点 | 缺点 | 目标 |
|------|------|------|------|------|
| **A** | knowledge 文档加「chronicler 例外」段落 | 与现状一致，无流程改变，改动最小 | 规则显得临时性，后续维护成本 | 接纳现状，文档化 |
| **B** | chronicler 也启用 worktree，doc commits 走 PR/squash 流程 | 流程统一，预防权限漂移，最体系化 | 增加 chronicler 复杂度，可能减速 | 强制统一，改变工作流 |
| **C** | git-workflow.md 显式区分"per-task agent"vs"chronicler/架构师/merger" | 规则清晰，无歧义，易维护 | 需维护多套规则，隐性复杂度 | 规则精细化，保持现状 |

## 后续处理

**当前**：
- 04db37f、a61a610 两个 commit 保持现状（本地 dev 未推）
- 本 dev-log 条目（042）仅文档观察，不 commit

**Phase 8 前**：
- 架构师完成选项 A/B/C 评估 + 裁定
- 根据选项修订规则、流程或文档

**v1.23 Plan**：
- 按架构师裁定编码治理变更
- 可能整合进 CONSTITUTION.md 或 git-workflow.md v2

## 教训

1. **规则自检**：编码规则时需考虑编码者自身的实践是否符合
2. **隐性例外的危害**：工作流上的「事实标准」应在文档中显式化，避免日后的冲突
3. **精细化权限模型**：「谁可直推 dev」需要按角色类型而非个人身份定义

## Pattern 观察

连环证据链：
- dev-log 033：tech-qa-t202 在主仓库写文件
- dev-log 041：tech-qa-t205 直接 commit 到 dev
- **dev-log 042**：chronicler 直推 dev（同时制订禁止规则）

共性：在边界处的权限认知模糊 → 反复违规 → 逐层暴露隐性约束

说明需要在 agent prompt 层面更早地预防，而不是事后规则补救。

