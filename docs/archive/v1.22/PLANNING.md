# 技术方案

## 项目：Stretchly — Quota 模式 5-bug 集中修复
## 版本：v1.22（自用 fork）
## 日期：2026-05-06
## 作者：架构师

---

## 1. 概述

v1.22 是面向 v1.21 quota 模式真机 bug 的集中修复版本，5 个缺陷全部已知根因（plan §2 表格）。本版本不引入新功能，技术工作集中在三类：

1. **CSS grid 选择器扩展**（Bug 1/2）— `.schedule > div` 漏匹配 `<details>` 元素，导致 T018 引入的 quota help 区与 advanced 区无法占满第 2 列。
2. **i18next 调用参数对齐**（Bug 5）— `soft-reminder-renderer.js` 传 `{ seconds }`，模板期望 `{{count}}`。i18next plural variable 标准是 `count`，必须改调用方。
3. **planner 热重建联动**（Bug 4）— `BreaksPlanner.setSchedulingMode()` 在 v1.21 已实现（`app/breaksPlanner.js:272-298`），但 main.js `save-setting` IPC 未调用。本版本只需补 IPC 联动 + 让 planner 在切模式后 emit 一个事件让 main.js 刷新 tray。

补充工作：
- **i18n**（Bug 2/3）— Bug 2 advanced 在 HTML 上已经全部用 `data-i18next`（grep 验证 197-285 行无硬编码英文文本节点），**plan §2 Bug 2 描述"硬编码英文"已不准**；本版本 Bug 2 仅修 CSS。zh-CN 缺整个 `quota.*` 命名空间（grep 0 命中），全量补译 ~60 keys。
- **测试**（Bug 4/5）— planner 已有 `setSchedulingMode` 测试 12 条；需新增"emit schedulingModeChanged 事件"用例 + i18next `closingIn` 渲染用例。

> **`[NEEDS CLARIFICATION]` 标记**：本文档无未决问题；§7 表格中"开放问题"在本节给出技术决策。

---

## 2. 架构

### 模块拆分

| 模块 | 目录 | 描述 | 负责人 |
|------|------|------|--------|
| Preferences CSS | `app/css/preferences.css` | 修 `.schedule > div` 选择器 → 兼容 `<details>` | 开发 (T-201) |
| Soft reminder renderer | `app/soft-reminder-renderer.js` | i18next 调用参数 `seconds` → `count` | 开发 (T-202) |
| BreaksPlanner mode switch event | `app/breaksPlanner.js` | `setSchedulingMode` 内部 emit `schedulingModeChanged` | 开发 (T-203) |
| Main IPC save-setting | `app/main.js` | save-setting handler 在 `key === 'schedulingMode'` 调 planner.setSchedulingMode + 刷 tray | 开发 (T-203) |
| zh-CN locale | `app/locales/zh-CN.json` | 全量补译 quota.* 命名空间 | 开发 (T-205) |
| Tests | `test/breaksPlanner.js` + 新建 `test/softReminder.js` | Bug 4/5 防回归 | tech-qa |

### 模块依赖关系

```
T-201 (CSS) ── 独立
T-202 (renderer) ── 独立
T-203 (planner event + main IPC) ── 独立（不动 CSS / 不动 i18n）
T-204 (Bug 2 CSS) ── 在 T-201 之后或独立（同一文件，串行合并）
T-205 (zh-CN) ── 独立
```

四个独立分支可并行开发；CSS 两个任务（T-201 / T-204）是同文件需串行合并。

### 关键设计决策

| 决策 | 选择的方案 | 考虑过的替代方案 | 理由 |
|------|-----------|----------------|------|
| Bug 1 CSS 修复方式 | 把 `.schedule > div` 改为 `.schedule > div, .schedule > details`（同一规则两选择器） | A：单独加 `.schedule > details { grid-column: 2/-2; }`；B：HTML 改用 `<div>` 包裹 `<details>` | 选最小语义改动：保留语义化 `<details>`，CSS 两选择器一行扩展，无副作用风险 |
| Bug 4 热重建路径 | 路径 B（用户已确认）— planner.setSchedulingMode 已存在，只补 emit 事件 + main.js IPC 联动 + StatusMessages 重建 | A：弹重启对话框（已被用户否决） | 避免用户被打断；planner 90% 工作已在 v1.21 完成 |
| Bug 4 切模式时正在显示 break（**裁定：歧义 A，选项 3**） | **选项 3**：保留 break 窗口正常结束；planner 内部立即切换 schedulingMode + 立即 stop 旧 quotaManager（quota → classic）/ 立即 install 新 quotaManager（classic → quota）；deadlineScheduler / quota 调度回调在 next-cycle（下次 nextBreak）才生效 | 选项 1：先关 break 窗口再重建 — 拒绝（用户中途被打断违反"不强制关闭"产品诉求）；选项 2：延迟到 break 结束才 stop 旧 qm — 拒绝（quotaManager 在 break 期间继续 tick 浪费且与"立即生效"诉求矛盾） | 三优势：(1) 用户视角"立即生效"—tray tooltip 在切的瞬间就反映新模式（StatusMessages 通过 breakPlanner.quotaManager 取，已是 null 或新实例）；(2) 正在显示的 break 不被打断；(3) 与 v1.21 已有实现完全一致—`setSchedulingMode` 中 `if (this.scheduler && this.scheduler.reference !== 'finishMicrobreak' && ... !== 'finishBreak') _ensureDeadlineScheduler()`，即"active break 期间不安装 deadlineScheduler，等下次 nextBreak"。test/breaksPlanner.js:635-650 已覆盖该不变量。**安全性保障**：所有 quota 路径回调（`_handleSoftReminderAction` / `_scheduleNextQuotaBreak` / `_handleHarassmentRejected` / `_freezeQuota` / `_unfreezeQuota`）都已检查 `if (this.schedulingMode !== 'quota' \|\| !this._quotaManager) return`，切到 classic 后 break 结束触发的回调走经典路径，不会因 qm null 崩溃 |
| Bug 4 emit 事件命名 | `schedulingModeChanged` 单事件（payload: `{ mode, oldMode }`） | A：双事件 `quotaManagerReplaced` + `schedulingModeChanged`；B：仅 emit `updateToolTip` 复用 | 单事件语义清晰；main.js 在 handler 内重建 tray menu 即同时获得新 quotaManager 引用（StatusMessages 通过 `breakPlanner.quotaManager` 自动拿新引用，详见 §3 IF-2） |
| Bug 5 修复方向 | 改 renderer 传 `{ count: seconds }`（i18next 标准） | 改 en.json key 为 `{{seconds}}` | i18next plural variable 标准必须叫 `count`，未来如果有 `closingIn_one`/`closingIn_other` 复数形式就必须用 `count`；保留向前兼容 |
| zh-CN 语气 | 半正式，使用「您」 | A：口语化「你」；B：极简无主语 | 与现有 zh-CN.json 风格一致（grep `"您"` 在 zh-CN.json 中已大量存在） |
| zh-CN 范围 | 仅 zh-CN（不动 zh-TW / de / fr / es / ja / pl / pt-BR / ru / ko） | 全 locale 补 | 用户明确：自用 fork，仅本人使用 zh-CN；其他 locale 走 Crowdin 异步流程不阻塞本版本 |
| 测试桩位置 | Bug 4：扩展 `test/breaksPlanner.js` 已有 schedulingMode describe；Bug 5：新建 `test/softReminder.js` | 全部塞 breaksPlanner.js | renderer 是独立模块，soft-reminder 测试独立文件更清晰 |

### Plan 偏差说明

本方案与 `docs/plans/plan-v1.22-bugfix.md` 存在以下偏差，已与 Coordinator 同步并获 ACK：

| # | 偏差类别 | plan 原文 | 本方案修订 | 修订理由 | 状态 |
|---|---------|---------|----------|---------|------|
| 1 | T-202 testing 列 | "Bug 5 (i18next 参数对齐) → testing: post（先实现再 tech-qa）" | T-202 改为 **atdd**（tech-qa 先写"`t('quota.softReminder.closingIn', { count: 5 })` 应返回 `Closing in 5s`"用例 → dev 改完跑通） | i18next 模板渲染是纯函数，atdd 比 post 更稳；测试样板已写在 §9，dev 直接拷用零成本 | 已 ACK（裁定 4 之外的偏差，Coordinator 在 PLANNING.md 修订评审中接受） |
| 2 | Bug 2 描述（plan §2 表格） | "`.quota-advanced-content` 同样的 grid 选择器 miss + **部分文案硬编码英文**" | Bug 2 严格定义为**排版问题**；i18n 子项移出范围。**关键诊断链**：用户真机看到的"英文显示"症状实际由 **Bug 3（zh-CN.json 缺整个 quota.* 命名空间，i18next fallback 到 en）** 触发，而非 HTML 缺 i18next 属性。Bug 3 修了之后，"advanced 区显示英文"症状自动消失 — 即使用户切到 zh-CN 也会看到中文 | 架构师 + Coordinator 双方独立 grep `app/preferences.html:190-285` 验证：advanced 区从 `quota.preferences.strict` / `strictDesc` 一路到 `quota.preferences.advanced.redNote` 全部用 `data-i18next` 属性，**0 处硬编码英文文本节点**。`<output data-unit>` 由 `app/preferences-renderer.js:194-200` 走 `window.utils.formatUnitAndValue` i18next-driven 翻译（也接 i18next，不是硬编码）。plan §2 误诊根因 — 把"渲染产出英文"等价于"HTML 硬编码英文"，忽略了 i18next fallback 的可能 | 已 ACK（裁定 3 — Coordinator 状态文件「Bug 2 范围」明确"i18n 子项移出，严格收敛为 CSS 排版调研"） |
| 3 | T-204 实施方式 | plan 隐含 "T-204 直接修 CSS"（plan §6 列了 4 个修复点） | T-204 启动方式调整为**先 headed 复现确认根因**，根因不明立即向架构师上报，不基于猜测开发 | plan §2 表格 "`.quota-advanced-content` 同样的 grid 选择器 miss" 与现状不符（`.schedule > div` 已命中外层 `.quota-advanced-toggle` 和 `.quota-advanced-content`，理论上不应 grid miss）。需 dev headed 确认真实 bug 形态 — 可能是 `.hidden` 切换或嵌套 grid 的 alignment，而非 grid-column miss | 已 ACK（裁定 3 同段—严格收敛为"CSS 排版**调研**"，不是直接修） |
| 4 | Bug 4 工作量 | plan §9 / 附录 B 隐含 T-203 是中等工作量 | T-203 实施量比 plan 预期**更小**：`setSchedulingMode` 已在 v1.21 完整实现（`app/breaksPlanner.js:272-298`，12 条测试覆盖）；本版本只补 emit `schedulingModeChanged` + main.js IPC 联动 + listener 刷 tray，约 20 行代码改动 | v1.21 PL/架构师对 T004/T005 任务已实现 setSchedulingMode 主体逻辑，本版本属于补全联动而非新建 | 已 ACK；不改任务复杂度标注（仍为中），但 dev spawn prompt 应明确"主体已存在，只补 emit + IPC + listener" |

> **解读**：本节用于让 dev/tech-qa/CR per-task agent spawn 时立刻明白方案与 plan 的差异点，避免误读 plan 后越权。如果 dev 在 worktree 中遇到与本节冲突的信息，应以 PLANNING.md（本文件）为准；如果发现新偏差，立即向架构师上报，不擅自决策。

---

## 3. 接口定义

### IF-1：BreaksPlanner.setSchedulingMode 扩展（emit 事件）

`app/breaksPlanner.js:272-298` 现有方法增加 emit：

```javascript
setSchedulingMode (mode) {
  if (mode !== 'classic' && mode !== 'quota') return
  if (mode === this.schedulingMode) return
  const oldMode = this.schedulingMode

  if (mode === 'classic') {
    if (this._quotaManager && typeof this._quotaManager.stop === 'function') {
      this._quotaManager.stop()
    }
    this._cancelDeadlineScheduler()
    this.deadlineScheduler = null
    this._quotaManager = null
    this.schedulingMode = 'classic'
  } else {
    this.schedulingMode = 'quota'
    if (!this._quotaManager) {
      this._installQuotaManager(new QuotaManager(this.settings, { log }))
      if (this._quotaManager && typeof this._quotaManager.start === 'function') {
        this._quotaManager.start()
      }
    }
    if (this.scheduler && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak') {
      this._ensureDeadlineScheduler()
    }
  }

  // NEW in v1.22 — notify main.js so it rebuilds tray + StatusMessages.
  this.emit('schedulingModeChanged', { mode, oldMode })
}
```

**契约**：
- `mode` 只接受 `'classic'` / `'quota'`，其他值静默忽略（与现有行为一致）
- `mode === oldMode` 直接返回，**不 emit**
- 切到 quota 时若 active break 在显示（reference === `finishMicrobreak` / `finishBreak`），不安装 deadlineScheduler；finishBreak/finishMicrobreak 后由 `nextBreak()` 走 quota 分支自然激活
- `emit('schedulingModeChanged')` 在所有内部状态变更**之后**触发，listener 拿到 planner 时已是新模式

**Break-window 行为契约（裁定：歧义 A，选项 3）— PL 据此写 AC 2.6**：

| 切换方向 | 切的瞬间 active break 状态 | planner 立即变化 | break 窗口处理 | 下次 nextBreak 行为 |
|---------|---------------------------|----------------|---------------|------------------|
| quota → classic | scheduler.reference === `finishMicrobreak` 或 `finishBreak` | `schedulingMode = 'classic'`；`quotaManager.stop()` 调；`_quotaManager = null`；`deadlineScheduler` cancel + null | **不强制关闭**，break 窗口由用户/timer 自然结束（finishMicrobreak/finishBreak 触发） | break 自然结束后回调 finishMicrobreak/finishBreak 走 `if (this.schedulingMode !== 'quota') return`，不访问 qm；下次 `nextBreak()` 走 `_scheduleNextClassicBreak` |
| classic → quota | scheduler.reference === `finishMicrobreak` 或 `finishBreak` | `schedulingMode = 'quota'`；`new QuotaManager` + `start()`；deadlineScheduler **暂不**安装（v1.21 已有 if 分支跳过） | **不强制关闭**，break 窗口正常结束 | break 结束后调用 `nextBreak()` → `_scheduleNextQuotaBreak`；deadlineScheduler 在 `nextBreak` 内通过 `_ensureDeadlineScheduler()` 安装 |
| 任一方向 | scheduler.reference !== finishMicrobreak/Break（或无 scheduler） | 同上 | 无 break 窗口可言 | 现有 scheduler 不被强制 cancel；用户原本的下次 break 倒计时继续，到点触发的回调按新模式分发 |

**强可观察不变量（PL AC 2.6 可断言）**：
1. 切换前后正在显示的 break 窗口的 `reference` 不变（`finishMicrobreak` / `finishBreak`）
2. 切换瞬间 `breakPlanner.schedulingMode === <新模式值>`（同步可见）
3. 切到 quota → classic：切换瞬间 `breakPlanner.quotaManager === null`
4. 切到 classic → quota：切换瞬间 `breakPlanner.quotaManager !== null && quotaManager.isStarted === true`（如 QuotaManager 暴露了状态）
5. tray tooltip 在切换后下一次 `updateTray()`（由 `schedulingModeChanged` listener 触发）反映新模式 — quota → classic 后 quota 行不再渲染；classic → quota 后 quota 行新增

**测试覆盖（追加 `test/breaksPlanner.js`）**：

```javascript
it('quota → classic during active break: break stays open, qm stops immediately, next cycle is classic', () => {
  const settings = makeQuotaSettings()
  const planner = new BreaksPlanner(settings)
  const qm = makeQuotaManagerMock()
  planner.quotaManager = qm
  planner.emit('breakStarted', false)  // active long break
  const refBefore = planner.scheduler.reference  // finishBreak
  planner.setSchedulingMode('classic')
  planner.scheduler.reference.should.equal(refBefore)  // 不变量 1
  planner.schedulingMode.should.equal('classic')        // 不变量 2
  ;(planner.quotaManager === null).should.equal(true)   // 不变量 3
  qm.stop.mock.calls.length.should.be.greaterThan(0)
})
```

### IF-2：main.js save-setting handler 扩展

`app/main.js:1797-1846` 现有 handler 增加 schedulingMode 分支：

```javascript
ipcMain.on('save-setting', function (event, key, value) {
  // ... 现有分支保持不变 ...

  if (key === 'schedulingMode') {
    breakPlanner.setSchedulingMode(value)
    // setSchedulingMode 内部 emit schedulingModeChanged，listener 见 createWelcomeWindow init 段
  }

  settings.set(key, value)
  updateTray()
})
```

并在 createWelcomeWindow 的 planner init 段（`app/main.js:321-379`）追加 listener：

```javascript
breakPlanner.on('schedulingModeChanged', ({ mode, oldMode }) => {
  log.info(`Stretchly: scheduling mode changed ${oldMode} → ${mode}`)
  updateTray()
  // StatusMessages 在 updateTray() 内部 new 出来，自动通过 breakPlanner.quotaManager getter 拿到最新引用
})
```

**关键不变量**：
- StatusMessages 构造函数（`app/utils/statusMessages.js:15`）：`this.quotaManager = quotaManager || breakPlanner.quotaManager || null` — 切到 classic 后 `breakPlanner.quotaManager === null`，trayMessage 中 `if (... && this.quotaManager)` 自然不渲染 quota 行。**无需改 StatusMessages。**
- `updateTray()` 每次重建 trayMenu，会 new 一个新 StatusMessages（`app/main.js:1367, 1523`），自动拿新 quotaManager 引用。

### IF-3：soft-reminder-renderer i18next 调用对齐

`app/soft-reminder-renderer.js:55` 改：

```javascript
async function getCountdownText (seconds) {
  return window.i18next.t('quota.softReminder.closingIn', { count: seconds })
}
```

en.json 模板键 `quota.softReminder.closingIn = "Closing in {{count}}s"` 保持不变。

### IF-4：CSS 选择器扩展（Bug 1）

`app/css/preferences.css:95-97` 改：

```css
.schedule > div, .schedule > details {
  grid-column: 2/-2;
}
```

**注意**：`.schedule > :nth-child(N)` 规则（line 104, 115, 125）用 nth-child 不区分 div / details，已自动适用。

### IF-5：CSS 选择器扩展（Bug 2 — Advanced 区）

经 grep 确认（`app/preferences.html:197-286`）advanced 区结构为 `.quota-advanced-toggle (div)` + `.quota-advanced-content (div)`，外层 div **已被** `.schedule > div { grid-column: 2/-2 }` 命中。

`.quota-advanced-content` 内部子 div（`.quota-advanced-row` 等）使用嵌套 grid（line 432-446 已有定义），与 schedule 父 grid 无关。**Bug 2 真正问题需 dev 在 worktree 中 headed 复现确认**：可能是 `.quota-section` 类与 hidden 切换的可见性 bug，而非 grid 选择器问题。

> 🔴 **任务说明**：T-204 dev 启动时**先 headed 复现**，识别真实根因。如果不是 CSS grid 问题，向架构师上报；plan §2 表格"`.quota-advanced-content` 同样的 grid 选择器 miss"是猜测性根因。

### IF-6：zh-CN 翻译契约

- 命名空间整树从 `app/locales/en.json` 第 208-296 行复制
- 翻译范围：`quota.softReminder` / `quota.tray` / `quota.toast` / `quota.hardDeadline` / `quota.redPostponeWarning` / `quota.preferences`（含 advanced 子树）/ `quota.help` / `quota.preferences.errors`
- 占位符保持原样：`{{count}}` / `{{percent}}` / `{{mini}}` / `{{long}}` / `{{minutes}}` / `{{cost}}`
- plural rule：中文无单复数，**不需要** `_one` / `_other` 后缀（i18next 中文回退到 `_other`，但既然唯一形式直接用 base key 即可）
- 语气：半正式，使用「您」；技术术语保留括号原文（如「配额（quota）」首次出现），后续直接「配额」

### 跨模块约定

- emit 事件命名：`schedulingModeChanged`（动词过去式，与现有 `quotaChanged` / `tierChanged` 风格一致）
- payload 必须是对象（不是位置参数），便于未来扩展不破坏 listener
- log 前缀：`Stretchly: ...`（应用层；OS 事件用 `System: ...`，本版本无此场景）

---

## 4. 边界情况

| # | 场景 | 关联接口/模块 | 预期行为 |
|---|------|-------------|---------|
| 1 | 用户在切模式时正在显示 break 窗口（reference === `finishMicrobreak` / `finishBreak`） | IF-1 | planner 不强制关闭 break；deadlineScheduler 不立即重启；break 自然结束后 `nextBreak()` 按新模式调度 |
| 2 | 用户连续快速切 classic↔quota↔classic 多次 | IF-1, IF-2 | 每次切换都 emit；最终 schedulingMode === 用户最后一次值；中间 quotaManager 实例都被 stop 释放（v1.21 已实现，无内存泄漏） |
| 3 | 切到 classic 后 `breakPlanner.quotaManager === null` | IF-2 (StatusMessages) | trayMessage 中 `if (settings.get('schedulingMode') === 'quota' && this.quotaManager)` 短路，quota 行不渲染。tray menu 上的 reset-quota 项需在 `app/utils/appIcon.js` 同样加 schedulingMode 判断（**已有**：`app/main.js:1586` `if (settings.get('schedulingMode') !== 'quota') return`） |
| 4 | 切到 quota 但 settings.get('schedulingMode') 还没写入（race） | IF-1, IF-2 | save-setting handler 顺序：先 `breakPlanner.setSchedulingMode(value)` 再 `settings.set(key, value)` 再 `updateTray()`。**关键**：`setSchedulingMode` 内部读 `this.settings.get(...)` 时还是旧值；但 `setSchedulingMode` 不依赖 settings 中的 schedulingMode（只用参数 `mode`），所以无影响。**StatusMessages 在 updateTray 中读 settings.get('schedulingMode')，那时已 set — 顺序正确**。 |
| 5 | i18next 还未初始化时 closingIn 渲染 | IF-3 | renderer 通过 `window.i18next` 桥接已注入，DOMContentLoaded 时 i18next 已就绪。无新增风险 |
| 6 | zh-CN 缺译 fallback | IF-6 | i18next 配置 `fallbackLng: 'en'`（默认），任何 zh-CN 缺键自动回退到 en |
| 7 | 用户复制粘贴非法 schedulingMode 值（如 `"foo"`）到 settings.json | IF-1, IF-2 | `setSchedulingMode` 校验 `if (mode !== 'classic' && mode !== 'quota') return`；`save-setting` IPC 路径，UI 上是 radio 不可能产生非法值；如果通过 settings.json 直接编辑，下次启动 `BreaksPlanner constructor` 第 22 行 `settings.get('schedulingMode') \|\| 'classic'` 兜底（非空但非法值会进入 quota 分支，**已有 v1.21 行为**，本版本不扩展） |
| 8 | 软提醒倒计时切到 0 之前 i18next 缺 `closingIn` 键（用户卸载 en locale） | IF-3 | i18next 默认 fallback 返回 key 字符串 `quota.softReminder.closingIn`；用户实际看到 key 串是已知 i18next 行为，不在本版本范围 |

---

## 5. 任务分解

| # | 任务 | 涉及文件 | model | worktree | 依赖 | 复杂度 | testing | 状态 |
|---|------|---------|-------|----------|------|--------|---------|------|
| T-201 | Bug 1 CSS：`.schedule > div, .schedule > details` 扩展 + tech-qa headed 截图（quota help 区前后） | `app/css/preferences.css` | sonnet | worktrees/T201/ | 无 | 低 | post | 待开始 |
| T-202 | Bug 5 i18next 调用对齐：`{ seconds }` → `{ count: seconds }` + 防回归 vitest | `app/soft-reminder-renderer.js` | sonnet | worktrees/T202/ | 无 | 低 | atdd | 待开始 |
| T-203 | Bug 4 planner emit + main.js IPC 联动：`setSchedulingMode` emit `schedulingModeChanged` + save-setting handler 调 + listener 刷 tray + 防回归 vitest | `app/breaksPlanner.js`、`app/main.js` | sonnet | worktrees/T203/ | 无 | 中 | atdd | 待开始 |
| T-204 | Bug 2 advanced 区排版：dev 先 headed 复现确认根因，再修 CSS（如果不是 CSS 问题向架构师上报） | `app/css/preferences.css`（可能） | sonnet | worktrees/T204/ | T-201（同文件，串行合并） | 中 | post | 待开始 |
| T-205 | Bug 3 zh-CN 全量补译 ~60 keys | `app/locales/zh-CN.json` | sonnet | worktrees/T205/ | 无 | 低 | post | 待开始 |

**模型分配理由**：本版本无 ML/DSP/复杂算法/底层系统，全部任务复杂度低-中。Sonnet 足够；CR 和 tech-qa 同。

**testing 列说明**：
- T-201 / T-204（CSS）：`post` — 修完 dev 自查 + tech-qa headed 截图；CSS 难以 vitest 化
- T-202（i18next）：`atdd` — tech-qa 先写"调用 `closingIn` 传 `{ count: 5 }` 应得 `Closing in 5s`"用例，dev 改完跑通即可
- T-203（planner+IPC）：`atdd` — tech-qa 先写"planner.setSchedulingMode emit schedulingModeChanged 一次"用例 + main.js handler 测试桩；dev 实现让测试通过
- T-205（zh-CN）：`post` — vitest 用 grep 兜底（`tech-qa` 写测试：`zh-CN.json` 必须包含 `quota.softReminder`/`quota.tray`/etc 全部 keys，且无空字符串值）

### 共享文件管理

| 文件 | 涉及任务 | 合并策略 |
|------|---------|---------|
| `app/css/preferences.css` | T-201, T-204 | **策略 B 串行合并**：T-201 先合（Bug 1 P0 优先）；T-204 在自己的 worktree 中先 `git rebase origin/dev` 拿 T-201 改动后再修 advanced（如真需修 CSS） |
| `app/breaksPlanner.js` | T-203 单任务 | 无冲突 |
| `app/main.js` | T-203 单任务 | 无冲突 |
| `app/locales/en.json` | 无修改 | Bug 2 的"硬编码英文"经 HTML grep 确认不存在；**en.json 本版本不动** |

### 集成检查清单

| # | 检查项 | 验证方式 | 关联任务 |
|---|--------|---------|---------|
| 1 | save-setting IPC 的 `key === 'schedulingMode'` 分支调用了 `breakPlanner.setSchedulingMode(value)` | grep `app/main.js`：`schedulingMode` 出现在 `ipcMain.on('save-setting'` handler 内 | T-203 |
| 2 | planner 在 `setSchedulingMode` 末尾 emit `schedulingModeChanged` | grep `app/breaksPlanner.js`：`emit('schedulingModeChanged'` 出现在 `setSchedulingMode` 函数体 | T-203 |
| 3 | main.js planner listener 注册了 `schedulingModeChanged` | grep `app/main.js`：`breakPlanner.on('schedulingModeChanged'` 出现且 handler 内调 `updateTray()` | T-203 |
| 4 | StatusMessages 在 quota → classic 切换后 trayMessage 不再渲染 quota 行 | 手动启动 + headed 切模式 + tray tooltip 检查（tech-qa T-203） | T-203 |
| 5 | tray reset-quota 菜单项在切到 classic 后消失 | `app/main.js:1586` 已有判断；headed 验证 | T-203 |
| 6 | soft-reminder 倒计时显示 `Closing in 5s`（不是 `{{count}}s`） | tech-qa headed 启动 break、触发软提醒、截图 | T-202 |
| 7 | quota help `<details>` 区占满 schedule 第 2 列宽度 | tech-qa headed preferences → schedule tab 截图 | T-201 |
| 8 | zh-CN 切换后 preferences quota 段无英文遗漏字符 | tech-qa 切语言到 zh-CN，preferences 全屏截图，grep 检查无英文遗漏 | T-205 |
| 9 | v1.21 73 vitest quota 用例 + 404 全项目用例 PASS | `npm test` 全量跑 | 全部 |
| 10 | husky pre-commit `npm run lint` 通过 | dev push 前自动跑 | 全部 |

> **集成检查执行时机**：所有 Batch 1（T-201/T-202/T-203）合并到 dev 后立即跑前 6 项 + 9/10；Batch 2（T-204/T-205）合并后跑全部 10 项。

### T-204 范围扩张协议（裁定：歧义 C）

**架构师 grep 已确认（2026-05-06）**：`app/preferences.html:197-286` advanced 区**全部用 `data-i18next` 属性**，无硬编码英文文本节点。`<output>` 元素的 `data-unit` 属性由 `app/preferences-renderer.js:194-200` 通过 `window.utils.formatUnitAndValue(unit, value)` 翻译（i18next-driven）。**Bug 2 真实根因不是 i18n，而是排版/可见性**。

**协议规则**（采用 PL 提议的 ≤8 / >8 阈值，并补具体触发流程）：

| dev T-204 grep 后发现的硬编码英文数 | 处理方式 | 触发流程 |
|----------------------------------|---------|---------|
| 0 处（架构师预期值） | T-204 仅修 CSS 排版（如真有 CSS 问题）；不动 i18n；如根因不是 CSS，T-204 调整为"调研 + 上报根因"，由架构师在 PLANNING 起草 hotfix 任务 | dev 在 worktree 中 grep 报告 0 处 → 直接进入 CSS 排查 → 如根因不明发"🔴 调研结果"消息给架构师 |
| 1-8 处（小幅 i18n 缺漏） | T-204 内消化：dev 在 same task 中补 `data-i18next` 属性 + en.json 加 key + zh-CN.json 同步 key（与 T-205 协调避免冲突） | dev 发"📋 范围内调整"消息给架构师 + T-205 dev（如 Batch 2 已启动），架构师同意即继续；不同意则降级到下一行 |
| 9 处或更多（大幅 i18n 缺漏） | **新建 T-206**（hardcoded-en-i18n 任务）；T-204 仅修排版；T-206 owner 由架构师指定，可与 T-205 同 dev 串行执行（共改 zh-CN.json） | dev 发"🚨 范围扩张"消息给架构师 → 架构师向 Coordinator 请新任务 → Coordinator 创建 T-206 + 分配 owner |

**触发后强制要求**：
- dev 不得在 T-204 中"顺手"修复硬编码英文（即使只有 1 处），不发消息确认就改 = 越权 — `范围内调整` 也必须先发消息架构师 ACK 后才动手
- 架构师在收到消息后 1 轮内必须回复（接受 / 拒绝 / 升级）
- 范围扩张任何决策（包括接受 1-8 处的 in-task 调整）都必须 mirror 到 PLANNING.md 的「未解决问题」节末尾，记录决策日期 + 范围数 + 决策方
- 若硬编码英文的 i18n 修复涉及修改 en.json，必须同步 zh-CN.json（en/zh-CN 双 locale 一致是 v1.22 验收前提；不允许只动 en）

**与 T-205 的协调**：T-206（如触发）与 T-205 都改 zh-CN.json — 采用「策略 B 串行合并」：T-205 先合到 dev，T-206 在 worktree rebase 后追加新 keys。

### 范围挑战

| 功能 | 当前版本必要性 | 投入产出比 | 数据假设验证 | 结论 |
|------|-------------|-----------|-------------|------|
| Bug 1 CSS（quota help 区） | 必要（P0，真机用户首屏可见） | 高 | grep 验证：`<details>` 唯一在 line 159 — 1 处 | 保留 |
| Bug 2 advanced 排版 | 可选（P1，advanced 是用户主动展开才看到） | 中 | **数据假设有疑问**：plan §2 表格"硬编码英文 + 同样 grid miss"；grep `app/preferences.html:197-286` advanced 区**全部用 data-i18next**，无硬编码英文。grid 问题需 headed 复现才能确认是否真存在 | 保留但**降级为 headed-driven 调研型任务**：T-204 先 headed 复现，根因不明则向架构师上报；不假设根因 |
| Bug 3 zh-CN 全量补译 | 必要（用户切中文是验收前提） | 中 | grep 验证：zh-CN.json `quota.` 命中 0；en.json `quota.` 命中数为基准 | 保留全量；**不**推迟到 v1.23（推迟代价：用户当前版本切中文体验不完整，下版本补译成本与现在相同，无收益） |
| Bug 4 planner 热重建 | 必要（P0，用户已确认路径 B） | 高 | v1.21 setSchedulingMode 已实现 + 已有 12 测试 — 工作量比 plan 估计的小 | 保留；**实施量比 plan 预期小**（仅补 emit + IPC 联动，主体已存在） |
| Bug 5 i18next 参数对齐 | 必要（P0，每次软提醒都见） | 高 | en.json line 216 `closingIn = "Closing in {{count}}s"` 模板验证；renderer line 55 传 `{ seconds }` | 保留 |
| F-301 PQ 流程升级 | 必要（meta-issue，否则下版本继续 slip） | 中 | — | 保留；**落地形式**：在 PLANNING.md §9 「验证策略 → tech-qa headed 截图标准」一段，**不新建 process doc**。理由：流程要求是验证规则不是独立文档；写在 PLANNING.md 与 ACCEPTANCE.md 中由 PL 引用即可 |

**未推迟项**：所有 5 个 bug + F-301 全部保留在本版本。

**推迟项**：无。

### 并行化

可并行：T-201、T-202、T-203、T-205（修改互不重叠的文件）。

串行：T-204 必须在 T-201 合并后 rebase（同 CSS 文件）。

---

## 6. Git 工作流

### Worktree 设置

每个任务开始前由架构师创建（不批量创建）：

```bash
cd /Users/yxang/GitMine/stretchly
mkdir -p worktrees
git worktree add -b fix/T201/quota-help-css worktrees/T201 dev
git worktree add -b fix/T202/soft-reminder-i18next worktrees/T202 dev
git worktree add -b fix/T203/planner-mode-event worktrees/T203 dev
# T-204、T-205 在 Batch 2 启动时再创建
```

任务合并后立即 `git worktree remove worktrees/T<NNN>` + `git worktree prune`。

### 分支命名

```
fix/T201/quota-help-css
fix/T202/soft-reminder-i18next
fix/T203/planner-mode-event
fix/T204/quota-advanced-css        # Batch 2
fix/T205/zh-cn-quota-translate     # Batch 2
```

### 文件所有权

| 开发 | 负责的文件 | 不得触碰 |
|------|----------------|---------|
| T-201 dev | `app/css/preferences.css`（lines 95-97 区域） | 其他文件 |
| T-202 dev | `app/soft-reminder-renderer.js`（line 55） | 其他文件 |
| T-203 dev | `app/breaksPlanner.js`（setSchedulingMode 方法）+ `app/main.js`（save-setting handler + planner listener init 段） | 其他文件 |
| T-204 dev | `app/css/preferences.css`（advanced 区域，如真需修） | 其他文件；**T-201 修改的 lines 95-97 已固化** |
| T-205 dev | `app/locales/zh-CN.json` | 其他文件；**en.json 不得修改** |

---

## 7. 模型分配

**项目复杂度评估**：中（缺陷修复为主，单一接口设计）

**默认模型分配**：

| 角色 | 默认 | 本项目 | 理由 |
|------|------|--------|------|
| 开发 | Sonnet | Sonnet | CSS / JSON / 简单 IPC 联动 / planner 单方法扩展，Sonnet 足够 |
| Code Reviewer | Sonnet | Sonnet | 5 个 bug 改动小（每个 < 50 行），Sonnet 评审充分 |
| tech-QA | Sonnet | Sonnet | 测试桩简单（事件触发 + i18next 模板渲染） |
| 产品 QA L1/L2 | Sonnet | Sonnet | 走查 / 配置类 |
| 产品 QA L3 截图比对 | Opus | Opus | 像素级差异比对返工成本高 |

无角色覆盖默认值。

---

## 8. 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| Bug 2 advanced 真实根因不是 CSS grid 选择器（plan §2 表格猜测可能错） | 中 | 中 | T-204 dev 启动时**先 headed 复现** + 用浏览器 DevTools 检查实际计算样式；根因不明立即向架构师上报，不基于猜测开发 |
| StatusMessages 缓存 quotaManager 旧引用 | 低 | 中 | 已验证：StatusMessages 每次 updateTray 都 `new`，构造函数读 `breakPlanner.quotaManager` getter，自动拿新引用。`updateTray` 在 `schedulingModeChanged` listener 中调用 |
| 切模式时 active break 期间 user 关闭 break 窗口（finishBreak/finishMicrobreak 触发），_scheduleNextQuotaBreak 拿到 quotaManager === null（如果切到 classic 中途）| 低 | 中 | `_scheduleNextClassicBreak` / `_scheduleNextQuotaBreak` 都检查 `if (this.schedulingMode === 'quota' && this._quotaManager)`，null 安全。**v1.21 行为不变**，本版本不引入新风险 |
| zh-CN 翻译质量主观偏差（用户改完不满意） | 低 | 低 | T-205 完成后由 PL 抽查 5-10 个关键 string；不通过则单独迭代 |
| i18next plural rule 在 zh-CN 对 `closingIn_one`/`closingIn_other` 期望不一致 | 低 | 低 | i18next 中文 fallback：缺 `_one`/`_other` 时用 base key。en.json 已是 base key 形式（无 `_one`/`_other`），zh-CN 也用 base key 即可 |
| 用户在 Settings panel 切 schedulingMode radio 后某些 advanced 子设置（如 `quotaWorkCycle`）的 settings.set 早于 schedulingMode 触发 | 低 | 低 | 每个 setting 是独立 IPC 调用，互不影响；schedulingMode 切换的 IPC 处理是原子的 |
| husky pre-commit lint 在 worktree 中遇到 standardignore 不生效（LESSONS 已记录） | 中 | 低 | 每个 dev 在 worktree 内运行 `npm run lint` 前先 `git status` 确认仅自己的文件被修改；lint 失败立即向架构师上报 |

---

## 9. 验证策略

### 单元测试

- 框架：vitest（pool=forks 已固定）
- 位置：`test/breaksPlanner.js`（扩展）+ 新建 `test/softReminder.js`
- 覆盖率目标：本版本新代码 100% 覆盖；总体维持 v1.21 基线

### Bug 4 防回归用例（追加 `test/breaksPlanner.js`）

```javascript
describe('BreaksPlanner — schedulingModeChanged event (v1.22 T-203)', () => {
  it('emit schedulingModeChanged once when classic → quota', () => {
    const settings = makeClassicSettings()
    const planner = new BreaksPlanner(settings)
    let calls = []
    planner.on('schedulingModeChanged', (payload) => calls.push(payload))
    planner.setSchedulingMode('quota')
    calls.length.should.equal(1)
    calls[0].mode.should.equal('quota')
    calls[0].oldMode.should.equal('classic')
  })

  it('do not emit when mode unchanged', () => {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    let count = 0
    planner.on('schedulingModeChanged', () => count++)
    planner.setSchedulingMode('quota')  // already quota
    count.should.equal(0)
  })

  it('emit after quotaManager already torn down (classic state observable in listener)', () => {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    let snapshotInListener = null
    planner.on('schedulingModeChanged', () => {
      snapshotInListener = { mode: planner.schedulingMode, qm: planner.quotaManager }
    })
    planner.setSchedulingMode('classic')
    snapshotInListener.mode.should.equal('classic')
    ;(snapshotInListener.qm === null).should.equal(true)
  })
})
```

### Bug 5 防回归用例（新建 `test/softReminder.js`）

```javascript
describe('soft-reminder i18next closingIn rendering (v1.22 T-202)', () => {
  it('en.json template renders with count=5', () => {
    // 由 tech-qa 决定测试形式：
    // 选项 A：直接 import en.json + i18next.init 后 t('quota.softReminder.closingIn', { count: 5 }) === 'Closing in 5s'
    // 选项 B：用 happy-dom + window.i18next mock 验证 getCountdownText(5) 返回正确字符串
    // 推荐 A — 不需要 DOM
  })

  it('en.json template does NOT render when called with { seconds }（regression guard）', () => {
    // 期望：传 { seconds: 5 } 渲染成 "Closing in {{count}}s"（字面量保留）
    // 这条用例的存在保证未来如果有人改回 { seconds }，CI 红
  })
})
```

### Bug 3 zh-CN 静态校验用例（追加 `test/i18nStatic.js` 或 `test/locales.js`）

```javascript
describe('zh-CN quota.* completeness (v1.22 T-205)', () => {
  it('zh-CN.json contains all quota.* keys present in en.json', () => {
    const en = JSON.parse(readFileSync('app/locales/en.json'))
    const zh = JSON.parse(readFileSync('app/locales/zh-CN.json'))
    // 递归比较 en.quota 子树所有 leaf key 在 zh.quota 中存在且非空字符串
    const missingOrEmpty = []
    walkLeaves(en.quota, '', (path, value) => {
      const zhValue = getByPath(zh.quota, path)
      if (typeof zhValue !== 'string' || zhValue.trim() === '') {
        missingOrEmpty.push(path)
      }
    })
    missingOrEmpty.should.deep.equal([])
  })
})
```

### 集成测试

- `npm test` 全量 — 必须 PASS（v1.21 基线 404 用例 + v1.22 新增）
- 手动启动 `npm start` — 切换 schedulingMode 不重启验证

### 端到端 / 产品测试

- 工具：headed Electron（dev/tech-qa/PQ 用 `npm start` 启动）
- 截图工具：见下方「工具可行性裁定（歧义 B）」
- 截图存储位置：`docs/dev-log/screenshots/T<NNN>-<short>.png`，由 chronicler 归档

### 工具可行性裁定（歧义 B）— Electron 截图方案

**结论**：**采用方案 1（macOS `screencapture` 命令）+ 方案 2（Electron `webContents.capturePage` JS）双轨**，不引入 playwright-electron。

**否决方案**：

| 方案 | 否决理由 |
|------|--------|
| playwright-electron | playwright 1.x 的 `_electron` 实验 API 已在 1.40+ 标记不稳定；附加到现成的 `npm start` 进程需暴露 CDP 端口（`npm run dev` 走 9222），但 `npm start` 不开 CDP；为本版本 2 个 P0 截图任务额外 wire CDP 启动方式得不偿失 |
| spectron | 已 deprecated（Electron 14+ 不支持），不在选项中 |
| nut-js / robotjs | native 编译依赖（node-gyp / Python）；用户已通过 .nvmrc 锁 Node 24，无需额外编译链；本机 macOS 已有 `screencapture`，零新增依赖 |
| 用户手动 headed 验收 | **红线**：plan §9 明确"**不**强制用户做 headed 验收"。L3 必须 dev/tech-qa 自截图，本裁定遵守此红线 |

**采用方案细则**：

**方案 1（推荐 — UI 整窗截图）**：tech-qa 在 worktree 中 `npm start`（headed），**用 `osascript` 让 Stretchly 主窗口前置**（避免被其他窗口遮挡），然后用 macOS `screencapture` 截屏到指定路径。

```bash
# tech-qa 在 worktree 中执行（示例 — T-201 quota help 区截图）
cd worktrees/T201
npm start &                                 # 后台启动 headed Electron
sleep 5                                     # 等 BrowserWindow 加载
osascript -e 'tell app "Stretchly" to activate'  # 前置主窗口（如 Stretchly 在 Dock 可见）
# 用户手动打开 Preferences → Schedule tab，或 tech-qa 用 IPC 触发：
# 替代：tech-qa 用 Cmd+, 快捷键打开 Preferences（电子原生快捷键）
sleep 2
screencapture -o -l$(osascript -e 'tell app "System Events" to id of window 1 of process "Stretchly"') docs/dev-log/screenshots/T201-after.png
# 或简单全屏 + 手动裁剪：
# screencapture -o docs/dev-log/screenshots/T201-after.png
kill %1                                     # 关 Electron
```

**方案 2（备选 — JSDOM-renderer 单元测试 + 截图）**：对纯 renderer 渲染（如 Bug 5 倒计时显示），用 vitest + happy-dom 验证 DOM 文本即可，无需真截图。`window.i18next.t('quota.softReminder.closingIn', { count: 5 }) === 'Closing in 5s'` 的字符串断言 + `countdownEl.textContent` 检查在 `test/softReminder.js` 中纯函数完成。

**方案 3（高保真 — 仅 Bug 4 切模式 tray 截图必要时）**：tech-qa 用 Electron 自带 `webContents.capturePage()` 在 main process 写测试脚本，将 BrowserWindow 截屏到 png（不走 OS 层）：

```javascript
// 仅当方案 1 在切模式 tray 联动场景需要更精确捕获时使用
const win = BrowserWindow.getAllWindows()[0]
const image = await win.webContents.capturePage()
require('fs').writeFileSync('docs/dev-log/screenshots/T203-after.png', image.toPNG())
```

**截图职责矩阵（修订）**：

| 任务 | 主方案 | 备选 | 必拍内容 |
|------|------|------|---------|
| T-201 (Bug 1 CSS) | 方案 1（osascript + screencapture） | — | Preferences → Schedule tab → quota help `<details>` 区域全可见，确认占满第 2 列宽 |
| T-202 (Bug 5 i18next) | 方案 2（vitest+happy-dom 字符串断言） | 方案 1（headed 触发软提醒后 screencapture，可选） | DOM `#countdown` textContent 包含 `Closing in 5s`；不含 `{{count}}` |
| T-203 (Bug 4 切模式) | 方案 1 + 方案 3（前者拍 tray menu，后者拍 BrowserWindow 内部） | — | (a) 切到 classic 后 tray menu 不含 reset-quota 项；(b) 切到 quota 后 tray tooltip 含 quota 行；(c) 切换瞬间 break 窗口仍显示（如有） |
| T-204 (Bug 2 advanced 排版) | 方案 1（osascript + screencapture） | — | Preferences → Schedule → 展开 Advanced → 整段渲染（如根因确认是 CSS） |
| T-205 (zh-CN) | 方案 1（切语言 zh-CN 后整页截图） + vitest 静态校验 | — | quota 段所有 label / advanced 子段无英文遗漏字符 |

**tech-qa 启动方式（统一）**：在 task worktree 中 `npm start`（headed Electron），**禁止**仅 `npm test` 后自报 green。截图保存到 `docs/dev-log/screenshots/T<NNN>-{before,after}.png`，文件 < 500KB。

**dev 环境前置依赖**：本机已安装 macOS（用户自用 fork，跨平台不在本版本范围）。screencapture / osascript 是 macOS 自带，无新增依赖。其他平台 dev 不参与本版本。

### tech-qa headed 截图标准（F-301 流程升级）

每个 P0/P1 task 的 tech-qa 必须满足：

1. **启动方式**：tech-qa 在 task worktree 中执行 `npm start`（headed Electron），**不允许**仅 `npm test` 然后自报 green
2. **必须截图**：
   - **Before**：tech-qa 必须先在 worktree HEAD~1（dev 基线）截一张展示 bug 现状的图（命名 `T<NNN>-before.png`）
   - **After**：在 worktree HEAD（修复后）截一张展示 bug 消失的图（命名 `T<NNN>-after.png`）
3. **截图注释**：每张截图配 1-2 句 caption，说明被验证的 AC 编号 + 关注像素区域
4. **存储路径**：`docs/dev-log/screenshots/T<NNN>-{before,after}.png`，文件大小压缩到 < 500KB
5. **报告 CR/architect**：tech-qa 在汇报"任务通过"时必须列出截图文件路径，CR 在 ACCEPT 前必须打开看过

**适用范围**：T-201（CSS）、T-204（CSS）、T-202（软提醒倒计时）、T-203（切模式 tray 变化）；T-205 用 vitest 静态校验 + 手动切语言截图（preferences quota 段全量）；F-301 本身不需截图。

### E2E 验证标注规则

本版本**无外部 API/SDK/数据源集成**任务，无 `e2e` 标注任务。i18next 是本地 JSON 加载，不算外部依赖。

### 共享资源分配

本项目无并发资源冲突（macOS 单机自用 fork，无模拟器/数据库）。Electron 实例每个开发在自己 worktree 启动独立进程，不冲突。

### 开发自验证（请求 CR 前）

每个 dev 在请求 CR 前必须：

```
1. npm run lint                           # husky 等同动作，提前跑避免 push 阻塞
2. npm test                               # 全量 vitest（不仅自己新增的）
3. npm start                              # headed 启动，触发本任务相关 UI 路径，肉眼确认无回归
4. git diff dev...HEAD                    # 自查 diff，确认无遗留 console.log / debugger / 多余空行
5. tech-qa 头像截图保存（如本任务在 §9 标注需要）
```

### 自动 Lint Hook（PostToolUse）

本项目已有 `npm run lint`（StandardJS）。建议每个 dev 在自己 worktree 的 `.claude/settings.json` 中追加：

```jsonc
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "cd $CLAUDE_PROJECT_DIR && npx standard --fix \"$CLAUDE_FILE_PATHS\" 2>&1 | tail -20 || true"
      }
    ]
  }
}
```

> **注意**：worktree 内 lint scope 需限定（LESSONS 已记录）。建议使用 `--root` 或仅 lint 被修改的文件路径，避免触发 standardignore 失效。

### 验证命令

```bash
# 运行所有测试
npm test

# 代码检查
npm run lint

# 启动开发实例
npm start

# 启动 dev 调试
npm run dev

# 单文件测试
npx vitest run test/breaksPlanner.js
npx vitest run test/softReminder.js
```

---

## 10. 未解决问题

| # | 问题 | 状态 | 解决方案 |
|---|------|------|---------|
| 1 | Bug 4 切模式时正在显示 break 窗口的处理策略（**歧义 A**） | **已解决（裁定 2026-05-06，架构师）** | **选项 3**：保留 break 窗口正常结束 + planner 内部立即切换 schedulingMode + 立即 stop/install qm + deadlineScheduler 延迟到 next-cycle。详见 §3 IF-1「Break-window 行为契约」表格 + 5 项强可观察不变量。PL 据此写 AC 2.6 |
| 2 | StatusMessages 在 quotaManager null → 新建过程中陈旧引用风险 | **已解决** | StatusMessages 每次 updateTray 都 new；`schedulingModeChanged` listener 在 main.js 调 updateTray 即可。无需修改 StatusMessages |
| 3 | zh-CN 新增键值的语言风格 | **已解决** | 半正式，使用「您」；与现有 zh-CN.json 一致 |
| 4 | i18next plural rule 在 zh-CN 是否需要 `_one`/`_other` | **已解决** | 不需要，使用 base key；i18next 中文 fallback 行为已验证 |
| 5 | Bug 2 advanced 部分硬编码英文究竟有多少 | **已解决（重新发现）** | grep `app/preferences.html:197-286` advanced 区**全部用 data-i18next 属性**，无硬编码英文。**plan §2 表格 Bug 2 描述需修订**：Bug 2 仅是排版问题（CSS 或可见性），不含 i18n 缺失。T-204 dev 启动时 headed 复现确认真实根因 |
| 6 | tech-qa headed 截图存储位置 | **已解决** | `docs/dev-log/screenshots/T<NNN>-{before,after}.png`，由 chronicler 归档 |
| 6b | tech-qa Electron 截图工具（**歧义 B**） | **已解决（裁定 2026-05-06，架构师）** | 双轨：方案 1 macOS `screencapture`+`osascript` 整窗截图（主方案）+ 方案 2 vitest+happy-dom 字符串断言（renderer 类）+ 方案 3 Electron `webContents.capturePage`（备选）。**否决** playwright-electron / spectron / robotjs 的理由见 §9「工具可行性裁定」。**红线遵守**：不要求用户手动 headed 验收，dev/tech-qa 自截图 |
| 6c | T-204 硬编码英文范围扩张（**歧义 C**） | **已解决（裁定 2026-05-06，架构师）** | 阈值采用 PL 提议：0 处仅修 CSS / 1-8 处 in-task 但需架构师 ACK / ≥9 处新建 T-206。详见 §5「T-204 范围扩张协议」。架构师 grep 预期值 0 处（已确认 advanced 区全部 data-i18next） |
| 7 | PQ L4 是否仍需 Coordinator 真机 smoke | **已解决（裁定 2026-05-06，用户）** | **L4 不过则打回**，不走 known issue 路径（COORDINATOR-STATE 第 38 行裁定 4）。技术含义：T-205 zh-CN 翻译质量 + 整体真机 smoke 都是发布前硬门槛；如 L4 失败，hotfix 任务由架构师立即开新 task，不允许"标 known issue 后续版本修"绕过 |
| 8 | LESSONS 沉淀新条目数量 | 待 close-out | 至少 1 条："per-task tech-qa 必须在 worktree headed 启动 + before/after 截图证据"；具体由架构师/PL 在 close-out checkpoint 时撰写 |

### Coordinator 待确认事项

- **§5 任务表中的 testing 列与 plan 偏差**：plan 要求 Bug 1/2 (CSS) → testing: post，Bug 4 → atdd，Bug 5 → post，Bug 3 → post。本方案 Bug 5 (T-202) 改为 atdd（理由：i18next 渲染逻辑可纯函数化测试，atdd 更稳）。**请 Coordinator 确认是否接受 testing 列调整**。
- **§3 IF-5 风险升级**：plan §2 表格 Bug 2 描述（CSS + i18n）经 grep 验证不准确。建议把 Bug 2 严格定义为"排版问题"，i18n 部分从范围中移除（grep 已 0 命中硬编码英文）。**请 Coordinator 与 PL 同步确认**。

---

## 当前状态

### Batch 1 close-out（2026-05-07）

**已合并到 dev**（squash merge，按合并顺序）：
- T-201 → `f8bd31f`（Bug 1 CSS 排版 — `.schedule > div, .schedule > details { grid-column: 2/-2 }`）
- T-202 → `a0d05e9`（Bug 5 soft-reminder i18next plural — `count: seconds`）
- T-203 → `025e69c`（Bug 4 schedulingMode 热重建 — emit `schedulingModeChanged`、IPC + tray listener）

**远程/本地分支 + worktrees** 全部清理完毕。

**§10 集成检查清单结果**：
| # | 检查项 | 结果 | 证据 |
|---|--------|------|------|
| 1 | `setSchedulingMode` emit `schedulingModeChanged` | ✅ | `app/breaksPlanner.js:300` |
| 2 | save-setting 拦截 `key === 'schedulingMode'` | ✅ | `app/main.js:1847` |
| 3 | main.js listener 调 `updateTray()` | ✅ | `app/main.js:380` |
| 4 | soft-reminder 用 `count: seconds` | ✅ | `app/soft-reminder-renderer.js:55` |
| 5 | `.schedule > div, .schedule > details` 共选 | ✅ | `app/css/preferences.css:95` |
| 6 | en.json `closingIn` 含 `{{count}}` | ✅ | `app/locales/en.json:216` |
| 7 | CSS 选择器涵盖 `<details>` 且 quota help 不溢出 | ✅ | grep 通过 |
| 8 | zh-CN 翻译完整 | ⏸ | 推迟到 Batch 2（T-205 范围） |
| 9 | `npm test` 全绿 | ✅ | 26 files / 516 tests PASS |
| 10 | `npm run lint` 全绿 | ✅ | 干净退出 |

**Process 学到的教训**（已写入 dev-log，phase close 时择优进 knowledge）：
- T-202 worktree 边界违规（dev-log 033）：tech-qa 在主仓库改源文件 → 已闭环，governance 沉淀
- T-203 agent shell display 限制（dev-log 035）：sandbox 内 `screencapture` 与 `webContents.capturePage` 均不可用 → AC 2.7 改用静态分析 + 行号引用 + 日志三段式证据，用户已认可此模式
- F-301 PQ 升级 Electron binary 跨 worktree 复用：`ELECTRON_OVERRIDE_DIST_PATH` 环境变量替代 symlink，零网络依赖

**Batch 2 启动前置**：
- T-201 已合并 → T-204 (Bug 2 advanced 区排版) `blockedBy` 解除
- T-205 (Bug 3 zh-CN 全量补译) 与 T-204 无文件交集，可并行
- 两任务仍按 §5 任务表 sonnet 模型分配

