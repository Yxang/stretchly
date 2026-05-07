---
name: retro
description: 从 git log 提取工程指标，生成版本回顾报告并写入 dev-log。
disable-model-invocation: false
---

# 工程回顾（Retro）

你将从 git log 中提取指标，生成结构化的工程回顾报告，并写入 `docs/dev-log/`。

## 调用方式

```
/retro [版本号]
```

示例：`/retro v3.0`

版本号缺省时，使用最近一个 git tag，无 tag 则提示用户输入。

---

## 第一步：确认版本范围

1. 如果用户提供了版本号，直接进入第二步
2. 否则，运行 `git tag --sort=-creatordate | head -5` 列出最近的 tag
3. 询问用户确认版本号和 git 范围（如 `v2.0..HEAD` 或 `dev` 分支自某日起）

---

## 第二步：提取原始数据

并行运行以下命令收集数据。**所有命令必须在主仓库根目录执行。**

### 2.1 提交总量与代码行变更

```bash
# 总 commit 数（排除 merge commit）
git log <范围> --no-merges --oneline | wc -l

# 代码行变更汇总
git log <范围> --no-merges --numstat --format="" | awk '
  /^[0-9]/ { add += $1; del += $2 }
  END { print "+" add " / -" del }
'
```

### 2.2 每任务 commit 分布

```bash
# 按分支/任务前缀统计 commit 数
git log <范围> --no-merges --format="%s" | grep -oE 'T[0-9]+' | sort | uniq -c | sort -rn
```

### 2.3 热点文件（变更频率 Top 10）

```bash
git log <范围> --no-merges --name-only --format="" | grep -v '^$' | sort | uniq -c | sort -rn | head -10
```

```bash
# 跨任务修改的共享文件（被 2 个以上任务分支修改过的文件）
git log <范围> --no-merges --format="%D %H" | \
  awk '/feat\/T[0-9]+|fix\/T[0-9]+|refactor\/T[0-9]+/{branch=$1} branch{print branch, $0}' > /dev/null; \
git branch -r | grep -E 'feat/T[0-9]+|fix/T[0-9]+|refactor/T[0-9]+' | \
  while read b; do git log origin/dev.."$b" --no-merges --name-only --format="" 2>/dev/null | grep -v '^$' | sort -u | sed "s|^|${b##*/origin/} |"; done | \
  awk '{files[$2][tasks[$2]++]=$1} END {for(f in files) if(tasks[f]>1) print tasks[f], f}' | sort -rn
```

### 2.4 时间分析（每任务耗时估算）

```bash
# 每个功能分支的首次和末次提交时间
git log <范围> --no-merges --format="%H %ci %s" | head -100
```

### 2.5 CR 与 QA 通过率（从 commit message 推断）

```bash
# 含 "rework" / "fix(cr)" / "fix(qa)" 的 commit，视为返工
git log <范围> --no-merges --format="%s" | grep -iE '(rework|fix.cr|fix.qa|revert)' | wc -l

# 总任务数（从 feat/fix/refactor 类型的 squash merge 推断）
git log <范围> --merges --format="%s" | grep -cE '^(feat|fix|refactor|test|chore)'
```

### 2.6 模型效率（从 CHRONICLE.md 提取）

```bash
# 读取 docs/team/CHRONICLE.md 或 docs/archive/ 下对应版本的 CHRONICLE.md
# 提取各角色使用的模型记录
```

---

## 第三步：计算指标

基于收集的原始数据，计算以下指标：

| 指标 | 计算方法 |
|------|---------|
| 总 commit 数 | 直接统计 |
| 代码行变更 | `+新增 / -删除` |
| 每任务平均 commit 数 | 总 commit / 任务数 |
| CR 首次通过率 | `(任务数 - 含 fix(cr) 的任务数) / 任务数 × 100%` |
| Tech-QA 首次通过率 | `(任务数 - 含 fix(qa) 的任务数) / 任务数 × 100%` |
| 返工轮次分布 | 按任务统计返工次数分桶 |

**数据不足判断**：
- 总 commit 数 < 5，或
- 无法推断任务数（无 squash merge，无 `T<NNN>` 前缀）

满足任一条件时，在报告所有指标后标注：

> ⚠️ 数据量有限，指标仅供参考。

---

## 第四步：生成报告

使用以下模板生成报告，**不生成** git 无法推断的字段（留空并注明"无法从 git log 推断"）。

```markdown
# 工程回顾 — v<版本号>

> 数据范围：<git 范围>
> 生成时间：<YYYY-MM-DD HH:MM>
> 框架版本：<读取 .claude/.template-version 的内容，如文件不存在则写 "未记录">

## 速度指标

- 总 commit 数：<N>（排除 merge commit）
- 代码行变更：+<新增> / -<删除>
- 任务数：<N>
- 每任务平均 commit 数：<N>

## 质量指标

- CR 首次通过率：<N>%
- Tech-QA 首次通过率：<N>%
- 返工轮次分布：
  - 1 轮（首次通过）：<N>%
  - 2 轮（返工 1 次）：<N>%
  - 3+ 轮（返工 2+ 次）：<N>%

## 热点文件

| 变更次数 | 文件 |
|---------|------|
| <N> | <文件路径> |
| ... | ... |

（Top 10，按变更频率降序）

### 跨任务共享文件

| 涉及任务数 | 文件 |
|-----------|------|
| <N> | <文件路径> |
| ... | ... |

（被 2 个以上任务分支修改过的文件，按涉及任务数降序）

## 时间分析

| 任务 | 首次提交 | 末次提交 | 耗时估算 |
|------|---------|---------|---------|
| T<NNN> | <时间> | <时间> | <小时/天> |

> 耗时 = 末次提交时间 - 首次提交时间，不含等待 CR/QA 的空档。

## 模型效率

| 角色 | 分配模型 | 任务数 | 备注 |
|------|---------|--------|------|
| Developer | <model> | <N> | <来自 CHRONICLE.md 或 PLANNING.md> |
| Code Reviewer | <model> | <N> | |
| Tech QA | <model> | <N> | |

> 模型效率数据来源：CHRONICLE.md / PLANNING.md §7。如无记录，填"N/A"。

## 改进建议

> ⚠️ 以下建议基于本次版本数据，请结合团队实际情况判断。

1. <基于热点文件数据的建议 — 如："X 文件变更 N 次，建议拆分或提取公共接口">
2. <基于返工率数据的建议 — 如："CR 返工率 N%，建议在 PR 前增加自检步骤">
3. <基于时间数据的建议 — 如："T<NNN> 耗时显著偏长，建议下次拆分为更小任务">

---

*数据量有限时省略此节，仅保留数据不足提示。*
```

**数据不足时的简化报告**：仅输出能计算的指标，末尾添加：

```
> ⚠️ 数据量有限，指标仅供参考。建议在积累更多版本数据后再评估趋势。
```

---

## 第五步：写入 dev-log

### 5.1 确定序号

```bash
ls docs/dev-log/ | grep -oE '^[0-9]+' | sort -n | tail -1
# 新序号 = 最大序号 + 1，补零到三位
```

### 5.2 写入文件

文件路径格式：`docs/dev-log/NNN-YYYYMMDD-HHMM-retro-v<版本>.md`

示例：`docs/dev-log/007-20260320-1430-retro-v3.0.md`

将第四步生成的报告完整写入此文件。

### 5.3 确认输出

向用户展示：

```
Retro 报告已生成：docs/dev-log/NNN-YYYYMMDD-HHMM-retro-v<版本>.md

摘要：
- 总 commit：<N>，代码行变更：+<N> / -<N>
- CR 首次通过率：<N>%，Tech-QA 首次通过率：<N>%
- 热点文件 Top 3：<文件1>、<文件2>、<文件3>
- 改进建议：<N> 条
```

---

## 附录：数据源优先级

| 数据 | 首选来源 | 备选来源 | 无法获取时 |
|------|---------|---------|---------|
| commit 数量/内容 | `git log` | — | 标注"无数据" |
| 代码行变更 | `git log --numstat` | — | 标注"无数据" |
| 任务列表 | commit message 中 `T<NNN>` 前缀 | CHRONICLE.md | 标注"无法推断" |
| CR/QA 返工次数 | commit message 关键词 | CHRONICLE.md | 标注"无法推断" |
| 模型分配 | `docs/team/PLANNING.md` §7 | `docs/archive/<版本>/PLANNING.md` | 标注"N/A" |
| 任务耗时 | 功能分支首/末 commit 时间差 | — | 标注"无法推断" |
