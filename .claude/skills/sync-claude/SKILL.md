---
name: sync-claude
description: 从 ~/GitMine/agent-team-template 同步 .claude 目录到当前项目。模板内容覆盖本地，本地额外内容询问用户。skip-list 中的文件（如 claude-dir-protection.md）仅 meta 项目自用，不同步。
disable-model-invocation: true
---

# 同步 .claude 目录

从模板仓库 `~/GitMine/agent-team-template/.claude/` 同步到当前项目的 `.claude/`。

## 源和目标

- **源（模板）**：`~/GitMine/agent-team-template/.claude/`
- **目标（当前项目）**：当前工作目录下的 `.claude/`

## 不同步的文件（skip-list）

以下文件是 meta 项目（agent-team-template）自用，**不得同步到下游项目**。扫描和分类阶段必须 filter 掉这些路径：

```
.claude/rules/claude-dir-protection.md   # 仅 meta 项目需要（下游项目不频繁改 .claude/，加载此规则只会增加 always-load 负担）
```

维护规则：向 skip-list 增删条目时，在此文件同步更新理由行。skip-list 始终是相对 `.claude/` 的相对路径。

## 执行步骤

### 第一步：扫描

分别列出源和目标的所有文件（递归），生成两份清单。**扫描结果必须排除上方 skip-list 中的所有路径**。

```bash
# 源文件清单（相对路径，排除 skip-list）
cd ~/GitMine/agent-team-template && find .claude -type f | grep -vF '.claude/rules/claude-dir-protection.md' | sort

# 目标文件清单（相对路径，排除 skip-list）
find .claude -type f | grep -vF '.claude/rules/claude-dir-protection.md' | sort
```

> 若 skip-list 条目扩充，`grep -vF` 改为 `grep -vFf /tmp/skip-list.txt` 或 multi-pattern `-vE`。

### 第二步：分类

将所有文件分为三类：

| 分类 | 条件 | 处理方式 |
|------|------|----------|
| **仅源有** | 文件只存在于模板 | 直接复制到目标 |
| **两边都有** | 文件同时存在 | 比较内容，不同则用源覆盖 |
| **仅目标有** | 文件只存在于当前项目 | **询问用户** |

### 第三步：执行同步

#### 3.1 仅源有 → 直接复制

```bash
mkdir -p <目标目录>
cp ~/GitMine/agent-team-template/<文件路径> <文件路径>
```

#### 3.2 两边都有 → 比较后决定

对每个两边都有的文件：
1. 用 `diff` 比较内容
2. 如果内容相同 → 跳过
3. 如果内容不同：
   - 用 Read 工具读取**两边**的文件
   - 判断差异：
     - **目标文件只是源的旧版本**（源包含了目标的所有内容，或对目标内容做了改进）→ 直接用源覆盖
     - **目标文件有额外的项目特定内容**（源中没有的内容）→ 向用户展示差异，询问处理方式：
       - 选项 A：用源覆盖（丢弃本地修改）
       - 选项 B：保留目标（不同步此文件）
       - 选项 C：手动合并（用户指示如何合并）

#### 3.3 仅目标有 → 询问用户

列出所有仅存在于目标的文件，询问用户：
- **保留**：这些是项目特定的文件，保持不动
- **删除**：这些是过时的文件，删除它们

允许用户逐个或批量选择。

### 第三.5步：写入模板版本号

从模板仓库获取当前版本（最新 git tag），写入目标项目的 `.claude/.template-version`：

```bash
# 获取模板仓库的最新 tag
TEMPLATE_VERSION=$(cd ~/GitMine/agent-team-template && git describe --tags --abbrev=0 2>/dev/null || echo "unknown")

# 写入目标项目
echo "$TEMPLATE_VERSION" > .claude/.template-version
```

此文件用于追溯：retro 报告可以读取此文件，知道该项目使用的框架版本，从而评估不同版本框架的效果差异。

### 第三.6步：创建 LESSONS.md symlink

如果项目有 `docs/LESSONS.md`，创建 symlink 使其被 Claude Code 自动加载为 rules 文件：

```bash
if [ -f docs/LESSONS.md ]; then
  ln -sf "$(pwd)/docs/LESSONS.md" .claude/rules/LESSONS.md
  echo "Created symlink: .claude/rules/LESSONS.md → docs/LESSONS.md"
fi
```

确保 `.gitignore` 中排除此 symlink（避免误提交）：
```bash
grep -q '.claude/rules/LESSONS.md' .gitignore 2>/dev/null || echo '.claude/rules/LESSONS.md' >> .gitignore
```

### 第四步：汇总

输出同步结果：

```
同步完成：
- 新增 N 个文件（从模板复制）
- 更新 N 个文件（用模板覆盖）
- 跳过 N 个文件（内容相同）
- 保留 N 个项目特定文件
- 删除 N 个文件（用户确认）
```

### 第五步：提交

询问用户是否需要 commit 同步结果。如果需要：

```bash
git add .claude/
git commit -m "chore: sync .claude from agent-team-template"
```

## 规则

- **源永远是权威** — 当两边都有且源包含了目标的内容时，不用问用户，直接覆盖
- **只有目标有额外内容时才问** — 避免不必要的交互
- **不要删除未确认的文件** — 仅目标有的文件必须经用户确认才能删除
- **保持目录结构** — 复制时自动创建缺失的父目录
