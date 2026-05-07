---
name: self-review
description: Checkpoint：回顾近期工作，写 memo，同步 knowledge，执行毕业检查。适用于单 agent 和完整版本的非团队对话。
disable-model-invocation: false
---

# Checkpoint（三省吾身）

回顾近期工作，写入每日反思日志（memo），同步知识库，执行毕业检查。

## 触发方式

以下任一方式触发：

- `/self-review [版本号或描述]`
- 用户说 "checkpoint"、"存档"、"保存进度"
- 每次重要任务完成后（主动执行）

版本号缺省时，回顾当前对话中的工作。

---

## 第一步：收集上下文

并行收集以下信息：

### 1.1 Git 历史

```bash
# 最近 20 条 commit（排除 merge）
git log --no-merges --oneline -20

# 如果提供了版本号，用 tag 范围
git log <范围> --no-merges --oneline
```

### 1.2 现有知识

```bash
# 读取现有 LESSONS.md（如有）
cat docs/LESSONS.md 2>/dev/null

# 读取 knowledge 索引（如有）
cat docs/knowledge/_INDEX.md 2>/dev/null
```

### 1.3 Memo 近期上下文

```bash
# 读取 memo 索引了解近期情况
cat docs/memo/_INDEX.md 2>/dev/null

# 读取最近 3 天的 memo（如有）
ls -t docs/memo/????-??-??.md 2>/dev/null | head -3
# 逐个读取内容
```

### 1.4 Dev-log 和 Chronicle（如有）

```bash
# 读取最近 5 个 dev-log 条目
ls -t docs/dev-log/ 2>/dev/null | head -5
# 逐个读取内容

# 读取 CHRONICLE（如有，团队模式下）
cat docs/team/CHRONICLE.md 2>/dev/null
```

### 1.5 当前对话中的问题

显式回顾当前对话中遇到的意外问题、返工、假设错误等。这些可能尚未记录在任何文件中。

---

## 第二步：三省吾身

基于收集的上下文，回顾三个问题：

### 2.1 做了什么

- 关键决策（技术选型、架构权衡、方案取舍）
- 重要变更（新模块、重构、接口变更）

### 2.2 犯了什么错、为什么

- 遇到的意外问题和根因
- 被返工的部分及原因
- 假设错误（数据格式、API 行为、依赖兼容性）
- 花了过多时间的地方

### 2.3 学到了什么经验（不限于踩坑）

- 用户表达了什么项目级偏好？（如工作方式、质量标准、优先级判断）
- 建立了什么项目惯例或约定？（如命名规范、合并策略、测试方式）
- 产生了什么灵感或待探索方向？

### 2.4 更好的方式

- 下次遇到类似问题的具体做法（不是泛泛的"要更小心"）
- 可以提前验证的假设
- 可以复用的模式或工具

---

## 第三步：Checkpoint — 写入知识

### 3.1 初始化（如需）

```bash
# 如果 docs/memo/ 不存在，创建并初始化
mkdir -p docs/memo
# 使用模板 .claude/templates/memo.md 创建 _INDEX.md（日期 / 关键词 / 摘要）

# 如果 docs/knowledge/ 不存在，创建并初始化
mkdir -p docs/knowledge
# 使用模板 .claude/templates/knowledge-index.md 创建 _INDEX.md

# 如果 docs/LESSONS.md 不存在，创建（含 ## 技术区 和 ## 产品区 两个 section）
```

### 3.2 写 Memo

在 `docs/memo/YYYY-MM-DD.md` 中记录今天的反思（使用模板 `.claude/templates/memo.md`）：

- **工作记录**：做了什么、关键决策及理由
- **复盘**：犯了什么错 + 原因分析、更好的方式
- **用户洞察**：用户原话/关键表达 + 意图解读

如需引用长篇分析，加 ref 链接：`详细分析见 [notes/YYYY-MM-DD-xxx.md](../notes/YYYY-MM-DD-xxx.md)`

篇幅控制在 50-100 行/天。如当天 memo 已存在，追加内容。

**规则：不记录 memo = 未完成的任务。**

### 3.3 更新 Memo Index

在 `docs/memo/_INDEX.md` 追加一行摘要（日期 / 关键词 / 摘要）。

### 3.4 Knowledge 同步检查

检查 `docs/knowledge/_INDEX.md` 中的现有条目，是否有因本次工作而过时的内容：

- 接口已变更但 knowledge 中仍记录旧接口
- 依赖已升级但 knowledge 中仍记录旧版本的坑
- 架构已调整但 knowledge 中仍基于旧架构

过时条目：更新内容或在 _INDEX.md 中标注过时。

**Superseded 检查**（新增）：检查是否有条目需标记为 superseded——接口发生重大变更、出现更好的替代方案、或旧条目结论已被推翻时，在该条目文件的 `Superseded By` 和 `Superseded On` 字段填入信息，并在 `_INDEX.md` 的 Superseded 列更新。

**按优先级加载 knowledge**（新增）：加载 knowledge 条目时，按 `importance × recency`（重要度 × 时近度）排序取 top-N 条，优先加载高重要度且近期仍活跃的条目。N 由当前任务上下文决定，建议范围 5-10 条：
- 聚焦单模块的小任务：取 top-5
- 跨模块或架构类任务：取 top-10
- 排序方式：`Importance` 字段（1-5）× `Updated` 距今天数的倒数；`Superseded` 非空的条目跳过不加载

### 3.5 毕业检查

按 `.claude/rules/docs-and-knowledge.md`「毕业机制」中的量化条件执行（Memo 3+ 天 → Knowledge；Knowledge 3+ 次对话 → LESSONS；LESSONS 2+ 周未触发 → 退回 Knowledge）。具体操作步骤见该文件。

### 3.6 维护现有知识

检查现有 LESSONS.md 条目：
- 已被框架或 CONSTITUTION 解决 → 移除
- 多条规则可合并 → 合并，保持精炼
- 总量控制在 50 行以内

### 3.7 Git Commit

```bash
git add docs/memo/ docs/knowledge/ docs/LESSONS.md docs/notes/
git commit -m "docs: checkpoint — 更新 memo 和知识库"
```

---

## 第四步：洞察与建议

基于 knowledge/ 历史模式和本次回顾，输出前瞻性建议：

- **风险预警**：当前架构或依赖中，是否存在与历史踩坑模式相似的潜在风险？
- **关联影响**：本次变更是否可能影响 knowledge 中记录的其他模块或流程？
- **模式识别**：是否出现重复踩坑模式（同类问题在多个版本出现）？如有，建议提升到 LESSONS.md 或 CONSTITUTION.md

如无明显洞察，简要说明"未发现显著模式"即可，不必强行输出。

---

## 第五步：向用户汇报

```markdown
## Checkpoint 完成

### Memo
- 写入/更新：docs/memo/YYYY-MM-DD.md
- [关键内容摘要]

### Knowledge 同步
- [如有：更新/标注过时的条目]
- [如无变更："所有条目仍然准确"]

### 毕业检查
- [如有：Memo → Knowledge 的毕业项]
- [如有：Knowledge → LESSONS 的毕业项]
- [如有：LESSONS → Knowledge 的退回项]
- [如无变更："无符合条件的毕业/退回"]

### 维护操作
- [如有：合并规则、移除已解决规则等]

### 洞察与建议
- [如有：风险预警、关联影响、模式识别]

### LESSONS.md 当前状态
- 技术区：N 条规则
- 产品区：N 条规则
- 总行数：N（限制 50 行）
```
