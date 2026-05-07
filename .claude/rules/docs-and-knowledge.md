# 文档与知识体系规范

本规则定义项目文档结构与知识管理方式，适用于所有对话模式（单 agent 和团队模式）。

## 原则

在相关的规划文档定稿并获批之前，不得开始开发。

## 文档目录结构

```
docs/
├── CONSTITUTION.md      ← 架构宪法（跨版本持久，修改需正式流程）
├── LESSONS.md           ← 项目级软规则（跨版本持久，始终加载，< 50 行）
├── knowledge/           ← 稳定结论（跨版本持久，按需加载）
│   ├── _INDEX.md
│   └── code-*.md / design-*.md / protocol-*.md / product-*.md / test-*.md
├── memo/                ← 每日反思日志（单 agent 模式）
│   ├── _INDEX.md
│   └── YYYY-MM-DD.md
├── notes/               ← 过程文档（长篇分析，不限篇幅）
│   └── YYYY-MM-DD-slug.md
├── plans/               ← /create-plan 输出
├── team/                ← 团队运作持久状态（当前版本）
├── archive/             ← 历史版本归档（只读）
├── dev-log/             ← 追溯员维护（追加式流水账）
└── api/                 ← 追溯员维护
```

## 五层知识体系

| 层级 | 文件 | 定位 | 加载策略 |
|------|------|------|---------|
| 硬约束 | `docs/CONSTITUTION.md` | "必须遵守" — 违反即 bug | 始终加载 |
| 软规则 | `docs/LESSONS.md` | "强烈建议" — 忽略大概率踩坑 | 始终加载 |
| 经验库 | `docs/knowledge/*.md` | "稳定结论" — 需要时查阅 | Index-first 按需加载 |
| 反思日志 | `docs/memo/*.md` | "每日反思" — 即时捕获观察 | Index-first，恢复近期上下文 |
| 过程文档 | `docs/notes/*.md` | "深度分析" — 长篇参考文档 | 靠 memo ref 发现，按需加载 |

## 对话启动时

1. 如有 `docs/LESSONS.md`，必读（已 symlink 到 `.claude/rules/` 则自动加载）
2. 如有 `docs/memo/_INDEX.md`，读取了解近期上下文
3. 如有 `docs/knowledge/_INDEX.md`，按当前任务 Tags 判断是否加载具体条目
4. 当天第二次对话：读 `docs/memo/` 当天文件恢复上下文

## CONSTITUTION 与 LESSONS 维护规则

### 架构宪法（CONSTITUTION.md）

- 跨版本持久，不随版本归档
- 修改需走正式流程：架构师提出 → Coordinator 审批 → 追溯员记录
- 所有 Agent 必须遵守，PLANNING.md 设计决策不得违反宪法

### 软规则（LESSONS.md）

- 始终加载，按 `## 技术区` / `## 产品区` 分隔，总量 ≤ 50 行
- 写入时机：团队关闭时的 checkpoint 阶段，从 knowledge 精炼提升
- **向下退回**：2+ 周未触发或已被框架解决 → 退回 knowledge（从 LESSONS.md 移除）

## Knowledge 前缀分类

- `code-*` — 代码架构（架构师写入）
- `design-*` — 设计决策（架构师写入）
- `protocol-*` — API/协议（架构师写入）
- `product-*` — 产品特性（Product Lead 写入）
- `test-*` — 测试（架构师写入）

每个条目使用模板 `.claude/templates/knowledge-entry.md`，更新 `_INDEX.md`（模板 `.claude/templates/knowledge-index.md`）。

## Memo 与 Notes 写入时机

### Memo（每日反思日志）

- 每天一个文件：`docs/memo/YYYY-MM-DD.md`，使用模板 `.claude/templates/memo.md`
- 篇幅 50-100 行/天；写完更新 `docs/memo/_INDEX.md`
- **单 agent 模式**：不记录 memo = 未完成的任务
- **团队模式**：不使用（dev-log + CHRONICLE 替代）

**必须写 memo 的触发点（团队模式）**：
- 测试失败、CR 拒绝、范围变更、接口决策

**必须写 memo 的触发点（单 agent 模式）**：
- 用户纠正、项目级偏好披露、新上下文披露、重要决策确定
- 踩坑、有 trade-off 的决策、建立项目惯例、产生灵感

### Notes（过程文档）

- 文件：`docs/notes/YYYY-MM-DD-slug.md`，自由格式，不限篇幅
- 适用于架构分析、方案对比、测试报告、调研笔记等长篇内容
- 不建独立索引，靠 memo 中的 ref 链接发现；过时内容不清理

## "记下/记住"意图区分

- **即时观察**（踩坑、小结论、灵感）→ `docs/memo/`
- **长篇分析**（架构对比、调研）→ `docs/notes/`，memo 中加 ref
- **稳定结论**（已验证的经验）→ `docs/knowledge/`
- **用户全局偏好**（跨项目习惯）→ auto-memory

不确定时写 memo（项目级更安全，不污染其他项目）。

## 毕业机制

| 路径 | 条件 | 操作 |
|------|------|------|
| Memo → Knowledge | 某结论在 **3+ 天** memo 中反复出现 | 创建 knowledge 条目；原 memo 位置留 redirect：`> 已迁移至 knowledge/xxx.md` |
| Knowledge → LESSONS | 某条 knowledge 在 **3+ 次对话**中被加载 | 在 LESSONS.md 对应区加一句话规则；knowledge 文件保留 |
| LESSONS → Knowledge | 某条规则 **2+ 周**未触发 | 从 LESSONS.md 移除；knowledge 文件保留 |

**判断时机**：在 Checkpoint 流程中执行。

## Checkpoint 流程（单 agent 模式）

**触发**：用户说 "checkpoint"/"存档"/"保存进度"，或每次重要任务完成后，或 `/self-review`。

1. **写 Memo** — 记录：做了什么、犯了什么错、更好的方式、用户洞察
2. **更新 Memo Index** — `docs/memo/_INDEX.md` 追加一行摘要
3. **Knowledge 同步检查** — 逐一检查已有条目是否还准确
4. **毕业检查** — 执行上方毕业机制判断
5. **Git commit** — `docs/` 下的变更

## 文件所有权

每个持久化文档有且只有一个写入者（具体矩阵见 architect.md 和 SKILL.md）。

| 文件类型 | 唯一写入者 |
|---------|-----------|
| `docs/CONSTITUTION.md` | 架构师（修改需 Coordinator 审批） |
| `docs/LESSONS.md`（技术区） | 架构师 |
| `docs/LESSONS.md`（产品区） | Product Lead |
| `docs/knowledge/code-* / design-* / protocol-* / test-*` | 架构师 |
| `docs/knowledge/product-*` | Product Lead |
| `docs/memo/*.md` | Claude（单 agent 模式） |
| `docs/notes/*.md` | Claude（单 agent）/ 架构师、PL（团队模式） |
| `docs/plans/*.md` | 用户（通过 /create-plan） |
| `docs/team/*.md` | 对应角色（COORDINATOR-STATE → Coordinator，PLANNING → 架构师，ACCEPTANCE → PL，CHRONICLE → 追溯员） |
| `docs/dev-log/*.md` / `docs/api/*` | 追溯员 |
| 源代码文件 | 被分配的开发 |
| 测试文件 | 技术 QA |

## Memory 五层 vs Dev-log

| | Memory 五层 | Dev-log |
|---|---|---|
| **关注点** | 踩了什么坑、学到什么经验 | 做了什么、发生了什么 |
| **视角** | 面向未来（下次怎么做） | 面向过去（发生了什么） |
| **消费者** | 下一个版本的 agent | retro 分析、历史回溯 |

dev-log 命名规范（`NNN-YYYYMMDD-HHMM-<描述>.md`）和记录时机详见 `chronicler.md`。

版本交接归档流程和团队文档管理详见 SKILL.md §9。

## 上下文恢复

所有 Agent 必须在以下情况下重新读取相关的持久化文件：
- idle 后重新开始新一轮工作时
- 感觉 context 过时或被压缩时
- 其他 Agent 报告文档有更新时
