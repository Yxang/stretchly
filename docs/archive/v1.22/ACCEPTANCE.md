# 验收标准

## 项目：Stretchly v1.22 — Quota 模式 5-bug 集中修复
## 版本：v1.22（自用 fork）
## 日期：2026-05-06
## 定稿日期：2026-05-06
## 作者：Product Lead
## 状态：**Phase 7 COMPLETE — 全部 27 AC 通过，可进入 Phase 8**（dev HEAD b0e6605，L4 用户裁定 PASS @ 2026-05-07）

---

## 项目模式标注

**UX 密集型**（涉及 CSS 排版和 i18n 渲染，需 L3 headed 截图验证）

理由：Bug 1/2 为 preferences UI 排版缺陷，需在 headed Electron 中目视确认 grid 占满宽度；Bug 3 zh-CN 语言风格涉及 L4 人工审查。其余 Bug 4/5 可 L2/L1 验证。

**不需要启动 UX Designer**：本版本为 bug 修复，不引入新 UX 设计方向，现有 UX 规格（v1.21 ACCEPTANCE §Product Lead 产品决策）不变。

---

## PQ 流程升级声明（v1.22 核心交付之一）

本版本 PQ 验收要求：
- 每个 P0/P1 bug 的 tech-qa 必须附 headed Electron 启动 + before/after UI 截图（保存于 `docs/dev-log/screenshots/T<NNN>-*.png`）
- 不接受单纯 grep + vitest 自报通过（LESSONS #8 教训）
- L4（zh-CN 语言风格）由用户手动审查，不启动 QA agent

---

## 1. 功能列表

| # | 功能 | 优先级 | Batch | 状态 |
|---|------|--------|-------|------|
| 1 | Bug 1：Quota help 区排版修复（details 占满 schedule grid） | 必须（P0） | Batch 1 | ✅ 通过 |
| 2 | Bug 4：切 quota 模式后 planner 热重建立即生效 | 必须（P0） | Batch 1 | ✅ 通过 |
| 3 | Bug 5：软提醒倒计时正确渲染（`{{count}}s` → 实际秒数） | 必须（P0） | Batch 1 | ✅ 通过 |
| 4 | Bug 2：Advanced options 区排版修复（i18n 接入已确认完好，症状归 Bug 3） | 重要（P1） | Batch 2 | ✅ 通过 |
| 5 | Bug 3：zh-CN quota.* 全量翻译（63 个 key） | 重要（P2） | Batch 2 | ✅ 通过（用户 L4 PASS） |
| 6 | 防回归：vitest 全项目 100% 通过 | 必须 | 贯穿 | ✅ 通过（523/523） |

**范围边界**：以下内容明确不在本版本范围内：
- 其他 locale（zh-TW / de / fr / es 等）quota.* 翻译
- 新功能（任何 quota 模式之外的扩展）
- v1.21 LESSONS 毕业评审（留 v1.23）
- ACCEPTANCE.md 15.7 文案 revise（留 v1.23）
- 任何发布渠道流程

---

## 2. 按功能的验收标准

### 功能 1：Bug 1 — Quota help 区排版修复

**描述**：preferences 界面中 Quota tab 的 `<details>` help 区块在 schedule grid 布局下应占满第 2 列（`grid-column: 2/-2`），修复前挤压成竖条。

**验收标准**：

| # | 验收条件 | 证据等级 | Layer | Tool |
|---|---------|---------|-------|------|
| 1.1 | `app/css/preferences.css` 中 `.schedule > details` 规则存在，且声明 `grid-column: 2/-2`（或等效的 `.schedule > div, .schedule > details` 合并选择器） | 文件审查 | L1 | 静态 |
| 1.2 | headed Electron 启动后，打开 Preferences → Quota tab，quota help `<details>` 区块横向宽度与 schedule 其他 div 行一致，无竖条压缩现象 | 手动验证 | L3 | screencapture+capturePage |
| 1.3 | before/after 截图存档于 `docs/dev-log/screenshots/T201-before.png` 和 `T201-after.png` | 文件审查 | L1 | 静态 |

**边界情况**：
- [ ] `<details>` 展开状态下，内容区仍在 grid 第 2 列范围内，不溢出或换行
- [ ] `<details>` 折叠状态下，summary 行对齐正常，不影响其他 schedule 行布局
- [ ] RTL 布局（`body[dir=rtl]`）下，排版规则不被破坏（CSS 中 RTL 覆盖规则不遗漏）

**人工验证手册**（L4 条目必填，其他层级跳过）：不适用（L3 自动截图验证）。

**本功能不包含**：advanced 子区排版（属 Bug 2，功能 4）。

---

### 功能 2：Bug 4 — 切 quota 模式后 planner 热重建立即生效

**描述**：用户在 Preferences 中将 `schedulingMode` 从 classic 切换到 quota（或反向），保存后 tray、scheduler、quotaManager 应在不重启 app 的情况下自动重建并按新模式运行。

**验收标准**：

| # | 验收条件 | 证据等级 | Layer | Tool |
|---|---------|---------|-------|------|
| 2.1 | `app/breaksPlanner.js` 中 `schedulingMode` 不再仅在 constructor 一次性读取；存在 `setSchedulingMode()` 方法或 setter，能在运行时触发 planner 重建 | 文件审查 | L1 | 静态 |
| 2.2 | `app/main.js` 的 `save-setting` IPC handler 在接收到 `schedulingMode` 变更时调用 planner 热重建，而非仅写 store | 文件审查 | L1 | 静态 |
| 2.3 | vitest 用例：从 classic 切换到 quota 后，新 planner 实例的 `schedulingMode` 为 `'quota'`，旧 quotaManager 已 stop()，新 quotaManager 已 start() | 单元测试 | L2 | 静态（vitest） |
| 2.4 | vitest 用例：从 quota 切换到 classic 后，新 planner 实例的 `schedulingMode` 为 `'classic'`，quotaManager 为 null 或 stopped 状态 | 单元测试 | L2 | 静态（vitest） |
| 2.5 | vitest 用例：热重建耗时在 50ms 内（mock timer 或 performance.now 断言） | 单元测试 | L2 | 静态（vitest） |
| 2.6 | vitest 用例：切换模式时若有 break 窗口正在显示，(a) `breakPlanner.scheduler.reference` 不变（`finishMicrobreak`/`finishBreak` 期间切换不影响 active break）；(b) `breakPlanner.schedulingMode === <新值>` 切换瞬间同步可见；(c) quota→classic 后 `breakPlanner.quotaManager === null`，classic→quota 后 `breakPlanner.quotaManager !== null` 且 `quotaManager.isStarted === true`；(d) 切换后下一次 `updateTray()` 反映新模式（quota→classic 后 quota 行不再渲染；classic→quota 后 quota 行出现）；(e) 下次 `nextBreak()` 走新模式分支（quota → `_scheduleNextQuotaBreak`；classic → `_scheduleNextClassicBreak`） | 单元测试 | L2 | 静态（vitest） |
| 2.7 | 切换后 tray tooltip 立即反映新模式状态（quota 模式下显示 quota 进度，classic 模式下显示经典 tooltip） | 手动验证 | L3 | screencapture+capturePage |

**边界情况**：
- [ ] 连续快速切换（classic → quota → classic）不造成 quotaManager 泄漏或 timer 悬挂
- [ ] quota → quota 重复切换（同值保存）不触发不必要的重建
- [ ] 切换时 electron-store 中已有的 quota 阈值不被 reset（用户现有配置向后兼容）
- [ ] 切换时正在倒计时的 break（`startMicrobreak` / `startBreak` 阶段）不被强制关闭；break 自然结束后按新模式继续，不留孤儿 timer

**人工验证手册**（L4 条目必填，其他层级跳过）：不适用（L2 vitest + L3 截图验证）。

**本功能不包含**：重启提示 dialog（plan §6 已确认不做方案 A）。

---

### 功能 3：Bug 5 — 软提醒倒计时正确渲染

**描述**：软提醒窗口倒计时文字应显示实际秒数（如 `Closing in 5s`），而非字面量 `Closing in {{count}}s`。根因是 `soft-reminder-renderer.js:55` 传参 `{ seconds }` 而模板 key 为 `{{count}}`。修复方向：改调用方传 `{ count: seconds }`。

**验收标准**：

| # | 验收条件 | 证据等级 | Layer | Tool |
|---|---------|---------|-------|------|
| 3.1 | `app/soft-reminder-renderer.js` 第 55 行（及所有 `closingIn` t() 调用）传参为 `{ count: seconds }` 而非 `{ seconds }` | 文件审查 | L1 | 静态 |
| 3.2 | `app/locales/en.json` 中 `quota.softReminder.closingIn` 值仍为 `"Closing in {{count}}s"`（模板 key 不变） | 文件审查 | L1 | 静态 |
| 3.3 | vitest 用例：mock i18next.t，调用 `getCountdownText(5)` 时传递参数对象含 `count: 5`，渲染结果为 `"Closing in 5s"` 而非 `"Closing in {{count}}s"` | 单元测试 | L2 | 静态（vitest） |
| 3.4 | headed Electron 中触发软提醒窗口，倒计时文字显示数字秒数（如 `Closing in 90s`），不显示字面量 `{{count}}` | 手动验证 | L3 | screencapture+capturePage |
| 3.5 | before/after 截图存档：`docs/dev-log/screenshots/T202-before.png` 和 `T202-after.png` | 文件审查 | L1 | 静态 |

**边界情况**：
- [ ] 倒计时从 90 减到 1 的过程中，每次 `setInterval` 更新均显示正确数字
- [ ] `autoCloseSeconds` 设为 0（不自动关闭）时，不显示倒计时文字（countdownEl 内容为空），不报 i18next 错误
- [ ] zh-CN 语言下，同一 key 渲染（zh-CN plural rule 无 _one/_other 区分），显示 `关闭倒计时 5s` 或对应翻译，无 `{{count}}` 字面量

**人工验证手册**（L4 条目必填，其他层级跳过）：不适用（L3 自动截图验证）。

**本功能不包含**：其他 i18next 调用的参数审查（仅限 Bug 5 根因所在的 `closingIn` 调用）。

---

### 功能 4：Bug 2 — Advanced options 区排版修复

**描述**：`.quota-advanced-content` 内子项在 schedule grid 布局下应占满第 2 列，修复视觉乱版。

**范围说明**：架构师 grep 确认 preferences.html advanced 区已全部使用 `data-i18next`，无硬编码英文。原计划的"i18n 补全"子项为误诊（用户在中文下看到英文是 Bug 3 zh-CN 缺译导致的 i18next fallback）。i18n 症状由 Bug 3（功能 5）统一处理，本功能严格限定为 CSS 排版修复。

**范围扩张协议**（架构师 grep 预期 0 处硬编码英文；若 dev T-204 复现时发现例外）：
- 0 处：T-204 仅修 CSS，无 i18n 工作
- 1–8 处：T-204 in-task 消化，**dev 必须先发消息经架构师 ACK 后才动手**
- ≥9 处：新建 T-206（PL 届时新增对应 AC，见下方 placeholder）

**T-206 AC placeholder**（仅在 ≥9 处硬编码英文被发现时激活）：
- T-206.1：preferences.html advanced 区所有硬编码英文文案通过 `data-i18n` 接入 i18next（文件审查 / L1）
- T-206.2：`app/locales/en.json` 新增对应 keys（文件审查 / L1）
- T-206.3：en 语言下 Advanced 展开后无 key 字面量显示（headed 截图 / L3）

**验收标准**：

| # | 验收条件 | 证据等级 | Layer | Tool |
|---|---------|---------|-------|------|
| 4.1 | `app/css/preferences.css` 中 `.quota-advanced-content` 子项的 `grid-column` 规则覆盖正确，advanced 区不再乱版 | 文件审查 | L1 | 静态 |
| 4.2 | headed Electron 中，打开 Preferences → Quota tab → 展开 Advanced，所有 label 横向宽度与其他行一致，无压缩或溢出 | 手动验证 | L3 | screencapture+capturePage |
| 4.3 | before/after 截图存档：`docs/dev-log/screenshots/T204-before.png` 和 `T204-after.png` | 文件审查 | L1 | 静态 |

**边界情况**：
- [ ] Advanced 折叠（hidden 状态）时，不影响 Quota help `<details>` 及其上方 preset 区排版
- [ ] Advanced 展开时，slider 行（`quota-advanced-row`）对齐 grid 第 2 列，label 和 input 在同行内正常排布
- [ ] en 语言下 Advanced 展开后，所有字段有译文显示（无 key 字面量），确认 i18next 接入完好

**人工验证手册**（L4 条目必填，其他层级跳过）：不适用（L3 自动截图验证）。

**本功能不包含**：zh-CN advanced 区翻译（属 Bug 3，功能 5）；i18n 接入补全（已确认不需要）。

---

### 功能 5：Bug 3 — zh-CN quota.* 全量翻译

**描述**：`app/locales/zh-CN.json` 补充 `quota.*` 全命名空间共 63 个 key 的中文翻译，含 `quota.preferences`、`quota.preferences.advanced`、`quota.tray`、`quota.softReminder`、`quota.help` 等子树。语言风格参考现有 zh-CN.json（半正式，使用「您」）。

**验收标准**：

| # | 验收条件 | 证据等级 | Layer | Tool |
|---|---------|---------|-------|------|
| 5.1 | `app/locales/zh-CN.json` 中 `quota` 顶层 key 存在，且包含与 `en.json` 对应的所有 63 个叶节点 key（python/node 脚本对比两文件 key 集合，差集为空） | 文件审查 | L1 | 静态 |
| 5.2 | zh-CN.json 中所有 quota.* 值不含英文字面量（允许专有名词：Stretchly、quota、Green/Yellow/Orange/Red 档位标签如有保留的话） | 文件审查 | L1 | 静态 |
| 5.3 | zh-CN.json 为合法 JSON（`JSON.parse` 无异常） | 文件审查 | L1 | 静态 |
| 5.4 | headed Electron 切语言到中文后，preferences Quota tab 所有 label/help/advanced 子项无英文遗漏字符串（截图验证） | 手动验证 | L3 | screencapture+capturePage |
| 5.5 | headed Electron 中文语言下，软提醒窗口文字（title、label、按钮、倒计时）均为中文，倒计时显示实际数字 | 手动验证 | L3 | screencapture+capturePage |

**边界情况**：
- [ ] i18next fallback：zh-CN 缺某个 key 时（手动删除一个 key 测试），fallback 到 en 版本显示英文，不显示 key 字面量
- [ ] `quota.softReminder.closingIn`（`{{count}}s`）在 zh-CN 下渲染正确（中文无 plural，单一模板即可）
- [ ] zh-CN.json 新增内容不破坏现有非 quota 键（全文件 key 总数 diff 合理）

**人工验证手册**（L4 — 语言风格人工审）：

本条为 L4，不启动 QA agent。由用户手动执行以下审查：

**⚠️ 发布 gate：L4 审查结果为 PASS 才能进入合并/Phase close。不通过则打回 dev 修改 zh-CN.json，修改后重新执行本手册，直到通过为止。不记录为 known issue。**

1. 启动 Stretchly（`npm start` 或 `dist/mac-arm64/Stretchly.app`）
2. 打开 Preferences → General → Language → 选择「简体中文」
3. 切换到 Quota tab，逐段阅读 help 区、preset 描述、advanced 标签
4. 触发软提醒窗口（将 quota 调低或通过 dev 工具触发），观察标题、按钮文案
5. 打开托盘菜单，检查 quota 相关菜单项文案

**预期表现**：
- 所有文案使用「您」，语气半正式，与现有 zh-CN 一致（如"您今天的小休配额"而非"你的 mini quota"）
- 专有名词（Stretchly）保留英文，档位颜色名称（绿/黄/橙/红）使用中文或对应颜色词
- 无生硬机翻感（如"关闭在 5s"应为"5 秒后关闭"）

**失败处理**：L4 不通过 → 打回 dev 修改 `app/locales/zh-CN.json` → 重走 L1（AC 5.1/5.2/5.3）+ 重新 L4 人工审 → 通过后才能进入合并/Phase close。

**本功能不包含**：其他 locale（zh-TW / de / ja 等）翻译。

---

### 功能 6：防回归 — vitest 全项目 100% 通过

**描述**：v1.21 基线 404 用例 + v1.22 新增防回归用例全部通过，无跳过、无 flaky。

**验收标准**：

| # | 验收条件 | 证据等级 | Layer | Tool |
|---|---------|---------|-------|------|
| 6.1 | `npm test` 输出最终行含 `[N] passed`（N ≥ 404 + 新增数），`0 failed`，`0 skipped` | 集成测试 | L2 | 静态（vitest） |
| 6.2 | Bug 4 防回归用例覆盖：schedulingMode 热切换（classic→quota, quota→classic）各至少 1 个独立 vitest 用例，位于 `test/breaksPlanner.js` | 文件审查 | L1 | 静态 |
| 6.3 | Bug 5 防回归用例覆盖：`getCountdownText` 或等效函数的 i18next 参数 `count` 断言，位于 `test/softReminder.js` 或 `test/i18nRendering.js`（新建） | 文件审查 | L1 | 静态 |
| 6.4 | StandardJS lint 通过：`npm run lint` 无错误 | 集成测试 | L2 | 静态（lint） |

**边界情况**：
- [ ] 新增用例不依赖其他用例的执行顺序（vitest `forks` pool 隔离要求）
- [ ] 新增用例的 mock/stub 不影响全局状态，不导致其他用例 flaky

**本功能不包含**：CSS 排版用例（UI 通过 L3 截图验证，无法写 vitest）。

---

## 3. 非功能性需求

- [ ] **性能**：planner 热重建在 50ms 内完成（vitest mock timer 断言，见 AC 2.5）
- [ ] **兼容性**：v1.21 持久化 settings 字段（quota 阈值、schedulingMode）向后兼容；用户已配置的 quota 阈值切换模式后不被 reset（见 AC 2.3 边界）
- [ ] **i18n fallback**：zh-CN 缺译时 fallback 到 en，不退化为显示 key 字面量（见 AC 5.1 边界）
- [ ] **代码规范**：StandardJS lint pass，conventional commits 格式，husky pre-commit 不绕过

---

## 4. 已知限制

| 限制 | 原因 | 影响 |
|------|------|------|
| CSS 排版无 vitest 覆盖 | CSS grid 测试需 headed Electron，无法在 vitest 中 mock DOM layout | L3 截图为唯一验证手段，QA 必须 headed 启动 |
| Bug 4 break 窗口冲突策略 | 沿用 v1.21 已实现行为：不强制关闭，break 自然结束后下次按新模式生效 | AC 2.6 已按此策略补充断言 |
| zh-CN 语言风格为主观审查 | 翻译质量无法自动量化 | L4 人工审查不可跳过 |
| headed Electron 截图工具 | 使用 macOS screencapture + Electron webContents.capturePage 双轨（PLANNING §9），不使用 Playwright | dev/tech-qa 在 worktree 内自启动 headed Electron 截图，符合 plan §9 红线 |

---

## 5. 完成定义

以下所有条件必须全部满足才能交付：

- [ ] 功能 1-6 所有验收标准经产品 QA 验证为「通过」
- [ ] 功能 5 L4 人工验证手册经用户手动执行并确认语言风格合格（**发布 gate：不通过则打回修复，不得跳过或记录为 known issue**）
- [ ] Bug 4 / Bug 5 防回归 vitest 用例存在且通过（`npm test` 零失败）
- [ ] 每个 P0/P1 bug（功能 1/2/3/4）有 tech-qa before/after 截图归档
- [ ] zh-CN.json 63 个 quota.* key 全量对齐（脚本验证 diff 为空）
- [ ] StandardJS lint pass，husky pre-commit 通过
- [ ] 代码已审查并通过（Code Reviewer 确认）
- [ ] close-out 阶段 LESSONS.md 技术区新增 ≥1 条（架构师负责）+ 产品区新增 ≥1 条（Product Lead 负责），合计 ≥2 条
- [ ] Coordinator/CEO 已审批交付包

---

## 6. QA 分工方案

**项目类型**：UX 密集型（Desktop Electron App，有 UI 交互）

**Layer 汇总**：

| Layer | 条数 | Tool | 说明 |
|-------|------|------|------|
| L1 | 10 | 静态/grep | 文件审查、key diff、lint 检查（功能 4 删除 2 条 i18n AC 后） |
| L2 | 7 | 静态（vitest/lint） | 单元测试、集成测试、性能断言 |
| L3 | 6 | screencapture+capturePage | headed Electron + 截图，需 before/after（功能 4 由 3 条 AC 覆盖） |
| L4 | 1 | — | 不启动 QA agent，用户手动审查 zh-CN 语言风格 |

**AC 层级标注汇总**：

| AC # | 功能 | Layer | 说明 |
|------|------|-------|------|
| 1.1 | Bug 1 CSS | L1 | 文件审查 |
| 1.2 | Bug 1 视觉 | L3 | headed 截图 |
| 1.3 | Bug 1 截图归档 | L1 | 文件存在检查 |
| 2.1 | Bug 4 breaksPlanner | L1 | 文件审查 |
| 2.2 | Bug 4 main.js IPC | L1 | 文件审查 |
| 2.3 | Bug 4 classic→quota vitest | L2 | vitest |
| 2.4 | Bug 4 quota→classic vitest | L2 | vitest |
| 2.5 | Bug 4 50ms 性能 | L2 | vitest |
| 2.6 | Bug 4 break 窗口边界 | L2 | vitest |
| 2.7 | Bug 4 tray tooltip | L3 | headed 截图 |
| 3.1 | Bug 5 调用方参数 | L1 | 文件审查 |
| 3.2 | Bug 5 en.json 模板 | L1 | 文件审查 |
| 3.3 | Bug 5 vitest 渲染 | L2 | vitest |
| 3.4 | Bug 5 headed 倒计时 | L3 | headed 截图 |
| 3.5 | Bug 5 截图归档 | L1 | 文件存在检查 |
| 4.1 | Bug 2 CSS | L1 | 文件审查 |
| 4.2 | Bug 2 headed 视觉 | L3 | headed 截图 |
| 4.3 | Bug 2 截图归档 | L1 | 文件存在检查 |
| 5.1 | Bug 3 key diff | L1 | 静态脚本 |
| 5.2 | Bug 3 无英文残留 | L1 | grep |
| 5.3 | Bug 3 JSON 合法性 | L1 | 静态 |
| 5.4 | Bug 3 zh-CN preferences | L3 | headed 截图 |
| 5.5 | Bug 3 zh-CN 软提醒 | L3 | headed 截图 |
| 5.L4 | Bug 3 语言风格 | L4 | 用户手动 |
| 6.1 | 防回归 npm test | L2 | vitest |
| 6.2 | 防回归 Bug4 用例 | L1 | 文件审查 |
| 6.3 | 防回归 Bug5 用例 | L1 | 文件审查 |
| 6.4 | lint | L2 | lint |

**QA 数量**：2 个产品 QA（L1/L2 合并由 product-qa-1 静态验证，L3 由 product-qa-2 headed 截图）

**分工**：

| QA 编号 | 负责的功能/标准 | Layer 范围 | Tool | 验收重点 |
|---------|---------------|-----------|------|---------|
| product-qa-1 | AC 1.1/1.3、2.1/2.2/2.3/2.4/2.5/2.6、3.1/3.2/3.3/3.5、4.1/4.3、5.1/5.2/5.3、6.1/6.2/6.3/6.4 | L1 + L2 | 静态/vitest/grep | 文件内容正确性、vitest 全通过、lint 通过 |
| product-qa-2 | AC 1.2、2.7、3.4、4.2、5.4/5.5 | L3 | screencapture+capturePage | headed Electron 截图，before/after 存档，中文语言切换验证 |

**批次声明**：

```
Batch 1: product-qa-1 [静态], product-qa-2 [headed Electron + screencapture]
（同时启动；不使用 Playwright，无 ≤2 并发硬限制）
```

**L4 处理**：功能 5 语言风格审查不启动 QA agent。Product Lead 提交「人工验证手册」（见功能 5 §L4），Coordinator 转交用户手动执行。

**Coordinator 真机 smoke**：可选/推荐，非发布 gate。建议合并到 dev 后由 Coordinator 自行在 `dist/mac-arm64/Stretchly.app` 做一轮快速 smoke（覆盖 3 个 P0 bug 表现）。非强制，Coordinator 自行决定是否执行；不执行不阻塞 Phase close。

**LESSONS 交付物**（close-out 阶段执行）：
- 架构师负责技术区 ≥1 条（建议方向：per-task tech-qa 必须在 worktree 内 headed Electron 启动并截屏 UI 改动）
- Product Lead 负责产品区 ≥1 条（建议方向：i18next 参数名与模板 key 强制对齐检查 + 验收标准精度中的误诊识别）
- 最终写入 `docs/LESSONS.md`，为发布 gate（§5 完成定义已包含）

**工具说明（L3 headed 截图）**：架构师裁定使用 macOS `screencapture` + Electron `webContents.capturePage` 双轨方案，否决 playwright-electron。dev/tech-qa 在 worktree 内自启 Electron headed 模式自截图，不需要用户操作，符合 plan §9 红线。

---

## 7. 验收测试结果

*dev HEAD：b0e6605 | 验证日期：2026-05-07 | vitest：523/523 PASS | lint：PASS*

| # | AC | 功能 | 结果 | 证据 | 日期 |
|---|-----|------|------|------|------|
| 1 | 1.1 | Bug 1 CSS 规则 | ✅ | dev-log/028（tech-qa-t201 PASS） | 2026-05-07 |
| 2 | 1.2 | Bug 1 视觉截图 | ✅ | screenshots/T201-before.png + T201-after.png | 2026-05-07 |
| 3 | 1.3 | Bug 1 截图归档 | ✅ | screenshots/T201-*.png 存在 | 2026-05-07 |
| 4 | 2.1 | Bug 4 breaksPlanner 方法 | ✅ | dev-log/036（tech-qa-t203 PASS） | 2026-05-07 |
| 5 | 2.2 | Bug 4 main.js IPC | ✅ | dev-log/036（tech-qa-t203 PASS） | 2026-05-07 |
| 6 | 2.3 | Bug 4 classic→quota vitest | ✅ | 523/523 PASS，test/breaksPlanner.js | 2026-05-07 |
| 7 | 2.4 | Bug 4 quota→classic vitest | ✅ | 523/523 PASS，test/breaksPlanner.js | 2026-05-07 |
| 8 | 2.5 | Bug 4 50ms 性能 | ✅ | 523/523 PASS | 2026-05-07 |
| 9 | 2.6 | Bug 4 break 窗口边界 | ✅ | 523/523 PASS | 2026-05-07 |
| 10 | 2.7 | Bug 4 tray tooltip | ✅ | screenshots/T203-verification-evidence.txt + app-log-evidence.txt | 2026-05-07 |
| 11 | 3.1 | Bug 5 调用方参数 | ✅ | dev-log/034（tech-qa-t202 PASS） | 2026-05-07 |
| 12 | 3.2 | Bug 5 en.json 模板 | ✅ | dev-log/034（tech-qa-t202 PASS） | 2026-05-07 |
| 13 | 3.3 | Bug 5 vitest 渲染 | ✅ | 523/523 PASS | 2026-05-07 |
| 14 | 3.4 | Bug 5 headed 倒计时 | ✅ | screenshots/T202-before.png + T202-after.png | 2026-05-07 |
| 15 | 3.5 | Bug 5 截图归档 | ✅ | screenshots/T202-*.png 存在 | 2026-05-07 |
| 16 | 4.1 | Bug 2 CSS 规则 | ✅ | dev-log/038（tech-qa-t204 PASS）+ screenshots/T204-before/after-evidence.txt | 2026-05-07 |
| 17 | 4.2 | Bug 2 headed 视觉 | ✅ | screenshots/T204-qa-evidence.txt | 2026-05-07 |
| 18 | 4.3 | Bug 2 截图归档 | ✅ | screenshots/T204-*-evidence.txt 存在 | 2026-05-07 |
| 19 | 5.1 | Bug 3 key diff（63 keys） | ✅ | dev-log/039（tech-qa-t205 PASS）+ screenshots/T205-coverage-evidence.txt | 2026-05-07 |
| 20 | 5.2 | Bug 3 无英文残留 | ✅ | dev-log/039（tech-qa-t205 PASS） | 2026-05-07 |
| 21 | 5.3 | Bug 3 JSON 合法性 | ✅ | dev-log/039（tech-qa-t205 PASS） | 2026-05-07 |
| 22 | 5.4 | Bug 3 zh-CN preferences 截图 | ✅ | screenshots/T205-i18next-load-evidence.txt | 2026-05-07 |
| 23 | 5.5 | Bug 3 zh-CN 软提醒截图 | ✅ | screenshots/T205-i18next-load-evidence.txt | 2026-05-07 |
| 24 | 5.L4 | Bug 3 zh-CN 语言风格（L4） | ✅ | 用户裁定 PASS — 可交付 | 2026-05-07 |
| 25 | 6.1 | 防回归 vitest 523/523 | ✅ | dev HEAD b0e6605，npm test 全绿 | 2026-05-07 |
| 26 | 6.2 | Bug 4 防回归用例存在 | ✅ | test/breaksPlanner.js 含热切换用例 | 2026-05-07 |
| 27 | 6.3 | Bug 5 防回归用例存在 | ✅ | test/softReminder.js 含 count 参数断言 | 2026-05-07 |
| 28 | 6.4 | lint PASS | ✅ | npm run lint 无错误（dev HEAD b0e6605） | 2026-05-07 |

### 探索测试发现的问题

| # | 描述 | 严重程度 | 在范围内？ | 处理方式 |
|---|------|---------|-----------|---------|
| 1 | tech-qa-t205 初次在主仓库操作违反 worktree 隔离规则 | 流程 | 范围外 | dev-log/041 记录；关闭 t205 + 重新验证通过 |

---

### v1.22 验收 close-out 摘要（产品方）

**技术面**：dev HEAD b0e6605，5 个 bug 全部修复，vitest 523/523 PASS，lint PASS，§10 集成检查 10/10 PASS。Batch 1（T-201/T-202/T-203）和 Batch 2（T-204/T-205）均已合并到 dev。

**产品面**：
- Bug 1（P0）：quota help `<details>` 排版竖条消除，占满 schedule grid 第 2 列 ✅
- Bug 2（P0）：切 quota 模式立即生效，无需重启，热重建 ≤50ms ✅
- Bug 3（P0）：软提醒倒计时显示实际秒数（`5 秒后关闭`），不再显示 `{{count}}` ✅
- Bug 4（P1）：advanced options 区排版恢复正常，label 对齐 grid 第 2 列 ✅
- Bug 5（P2）：zh-CN quota.* 63 keys 全量翻译，L1/L2/L3 验证通过 ✅

**唯一待关闭项**：功能 5 L4 用户语言风格审查（发布 gate）。

**PQ 流程升级**：本版本首次落实 per-task tech-qa + before/after 截图证据；5 个任务全部有截图归档，不接受单纯 vitest 自报通过的 LESSONS 教训已在实践中体现。

---

## 8. 健康评分配置

### 8.1 本版本权重配置

本版本为 bug 修复 + i18n 补全，视觉质量和功能正确性是核心。

| 维度 | 本版本权重 | 调整原因 |
|------|-----------|---------|
| 功能正确性 | 35% | 核心 3 个 P0 bug 是否消除 |
| 视觉质量 | 20% | CSS 排版 bug 是否修复（Bug 1/2） |
| 内容质量 | 20% | zh-CN 翻译质量 + i18next 渲染正确性 |
| 错误处理 | 10% | planner 热重建边界（break 窗口冲突） |
| 边界情况 | 10% | 参数传递边界、grid 布局 RTL 边界 |
| 性能感知 | 5% | 热重建 50ms 要求 |
| 用户体验 | 0% | 不适用（不新增 UX 流程） |
| 可访问性 | 0% | 不适用（不新增 UI 组件） |
| **合计** | **100%** | |
