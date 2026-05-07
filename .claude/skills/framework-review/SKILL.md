---
name: framework-review
description: 跨项目聚合分析：扫描使用框架的项目，读取 retro 报告 + LESSONS.md + knowledge 索引，输出系统性问题和改进建议。
disable-model-invocation: false
---

# 框架级回顾（Framework Review）

跨项目聚合分析，发现系统性问题，驱动框架 prompt 改进。

## 调用方式

```
/framework-review [搜索根目录列表]
```

示例：`/framework-review ~/Git ~/GitMine ~/GitNews`

搜索根目录缺省时，使用 `~/Git ~/GitMine ~/GitNews`。

---

## 第一步：扫描使用框架的项目

在每个搜索根目录下查找使用本框架的项目：

```bash
# 查找包含 .claude/.template-version 的项目
find <搜索根目录> -maxdepth 3 -name ".template-version" -path "*/.claude/*" 2>/dev/null
```

对每个发现的项目，记录：
- 项目路径
- 框架版本（读取 `.claude/.template-version`）
- 最近的 git tag（项目版本）

---

## 第 1.5 步：截止点检测（增量扫描基线）

在收集数据前，先确定增量扫描的截止点：

```bash
# 读取 docs/framework-review/ 中最新报告的日期
ls -1 docs/framework-review/*.md 2>/dev/null | sort -r | head -1
```

从最新报告文件名中提取日期（格式 `YYYYMMDD`），转换为 `YYYY-MM-DD` 格式后作为本次扫描的截止点（与 `_INDEX.md` Updated 列格式一致，便于直接比较）。

- **有历史报告**：截止点 = 最新报告日期。后续步骤中 Knowledge/notes 只处理 Updated > 截止日期的条目
- **无历史报告**（首次运行）：截止点 = 无（fallback 全量扫描，所有数据源完整读取）

---

## 第二步：收集数据

对每个项目，按优先级收集以下数据（文件不存在则跳过）：

> 增量规则：如第 1.5 步确定了截止点，以下标注 `[增量]` 的数据源只处理截止日期之后的条目；标注 `[全量]` 的始终完整读取。首次运行（无截止点）时所有数据源均全量读取。

### 2.1 Retro 报告 `[增量]`

```bash
ls <项目>/docs/dev-log/*retro* 2>/dev/null
```

读取截止日期之后的 retro 报告（按文件名中的日期判断），提取：质量指标（CR/QA 通过率）、热点文件、改进建议。

### 2.2 LESSONS.md `[全量]`

```bash
cat <项目>/docs/LESSONS.md 2>/dev/null
```

整体读取，提取所有软规则条目。LESSONS.md 可能有增删，无法按日期增量。

### 2.3 Knowledge Index `[增量]`

```bash
cat <项目>/docs/knowledge/_INDEX.md 2>/dev/null
```

读取索引，只加载 Updated 列日期 > 截止日期的条目的 Tags 和摘要（不加载详细文件，除非需要深入分析）。

### 2.4 Dev-log 中的 Pattern Notes `[增量]`

```bash
grep -r "Pattern Note" <项目>/docs/dev-log/ 2>/dev/null
```

只处理截止日期之后的 dev-log 文件（按文件名中的日期判断），提取追溯员标记的重复模式。

---

## 第三步：聚合分析

按框架版本分组，分析以下维度：

### 3.1 跨项目重复问题

在多个项目的 LESSONS.md / knowledge 中出现的相同或相似规则：
- 同一问题在 3+ 项目出现 → 候选毕业到框架 prompt
- 同一问题在 2 个项目出现 → 标记观察

### 3.2 质量趋势

从 retro 报告中提取：
- 产品 QA 首次通过率的跨项目分布
- CR 返工率的跨项目分布
- 常见失败模式分类

### 3.3 框架版本效果对比

如果有多个框架版本的项目数据：
- 对比不同框架版本下的质量指标
- 识别框架改进的实际效果

### 3.4 未被框架覆盖的系统性问题

LESSONS.md 中的规则如果与框架 prompt 内容无关，说明是框架未覆盖的问题域。

---

## 第四步：生成报告

```markdown
# 框架级回顾 — [日期]

> 扫描范围：[搜索根目录列表]
> 项目数：[N]
> 框架版本分布：[版本 → 项目数]
> 增量截止点：[YYYY-MM-DD]（基于最新历史报告）/ 全量扫描（首次运行）

## 跨项目重复问题（候选毕业到框架）

| 问题 | 出现项目数 | 涉及项目 | 建议 |
|------|-----------|---------|------|
| [问题描述] | [N] | [项目列表] | [毕业到哪个 prompt/规则] |

## 质量趋势

### 产品 QA 首次通过率
- 中位数：[N]%
- 最低：[N]%（[项目]）
- 最高：[N]%（[项目]）

### CR 返工率
- 中位数：[N]%
- 常见返工原因：[分类列表]

## 框架版本效果对比

| 指标 | v[旧] (N 项目) | v[新] (N 项目) | 变化 |
|------|---------------|---------------|------|
| [指标名] | [值] | [值] | [↑/↓ N%] |

## 改进建议

1. **[建议标题]**：[具体改进内容 + 涉及的框架文件]
2. ...

## 各项目 LESSONS.md 汇总

| 项目 | 条目数 | 代表性规则 |
|------|--------|-----------|
| [项目名] | [N] | [最有参考价值的 1-2 条] |
```

---

## 第五步：输出

将报告写入当前框架项目的 `docs/framework-review/` 目录：

```bash
mkdir -p docs/framework-review
```

文件名：`YYYYMMDD-framework-review.md`

向用户展示报告摘要和改进建议。
