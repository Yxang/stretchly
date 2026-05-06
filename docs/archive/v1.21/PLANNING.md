# 技术方案

## 项目：Stretchly — Quota 式弹性休息调度
## 版本：v1.21（自用 fork）
## 日期：2026-04-21
## 作者：架构师

---

## 1. 概述

在现有"固定节奏调度"基础上新增一套"Quota 弹性调度"，两者通过 `schedulingMode` 设置互斥切换。核心新增模块：

- `app/utils/quotaManager.js` — 工作消耗 / 休息补充 / 推迟扣减 / 档位判定 / 持久化 / 每日重置 / 长休硬底线
- `BreaksPlanner` 里新增 `schedulingMode === 'quota'` 分支（经典路径零改动）
- 新渲染窗口 `app/soft-reminder.html` + 对应 preload/renderer — 🟡/🟠 档使用的"角落软提醒小窗"
- 托盘图标和 tooltip 根据 quota 档位/百分比变色
- preferences 新增"调度模式"+"Quota 设置"分区（3 preset + 高级折叠）

关键设计承诺：**经典模式零回归**——`schedulingMode === 'classic'` 时所有路径、事件、UI、设置语义与当前 trunk 完全一致。

> **`[NEEDS CLARIFICATION: ...]` 标记**：本文档中任何无法确定的设计点，必须使用此标记显式标注，并向 Coordinator 上报。不允许猜测性实现。

当前需要澄清的设计点全部集中在 §10「未解决问题」。

---

## 2. 架构

### 模块拆分

| 模块 | 目录 | 描述 | 负责人 |
|------|------|------|--------|
| QuotaManager | `app/utils/quotaManager.js` | 双 quota 状态机：消耗/补充/推迟扣减/档位判定/每日重置/硬底线倒计时；EventEmitter，不触碰 Electron API | 开发 |
| QuotaManager 单元测试 | `test/quotaManager.js` | vitest；覆盖 0/100/溢出、冻结、重置、档位切换、硬底线触发与退出、跨 JS 时钟的 fake timer | 技术 QA（ATDD） |
| BreaksPlanner 升级 | `app/breaksPlanner.js` | 新增 `schedulingMode` 分支；quota 路径下 `nextBreak` 查 QuotaManager 判定档位；pause/resume 链路通知 QuotaManager 冻结/解冻；长休硬底线 scheduler | 开发 |
| 软提醒窗口 | `app/soft-reminder.html`, `app/soft-reminder-preload.mjs`, `app/soft-reminder-renderer.js` | 非全屏、不抢焦点、屏幕角落；三按钮（现在休 / +2 分 / 忽略）；键盘可操作；显示当前 quota 条 | 开发 |
| 软提醒窗口集成 | `app/main.js` | 响应 `startSoftReminder` 事件创建/关闭 `softReminderWin`，接管窗口定位（带 Wayland fallback），处理 IPC | 开发 |
| 托盘 quota 可视化 | `app/utils/appIcon.js`, `app/main.js`, `app/utils/statusMessages.js` | 按档位替换图标文件名后缀；tooltip 添加两行 quota 文本 | 开发 |
| 设置与迁移 | `app/utils/defaultSettings.js`, `app/main.js`（migrations） | 新增 `schedulingMode` / `quotaPreset` / `quotaAdvanced` 等字段；electron-store 新 key 默认值 | 开发 |
| Preferences UI | `app/preferences.html`, `app/preferences-renderer.js`, `app/preferences-preload.mjs`, `app/css/preferences.css` | 新增"调度模式"单选 + "Quota"分区（3 preset 单选 + 高级折叠展开高级参数） | 开发 |
| 命令与快捷键 | `app/utils/commands.js`, `app/utils/breakShortcuts.js` | 新增 `resetQuotaShortcut`、`stretchly reset-quota` 命令；托盘菜单项"重置 quota" | 开发 |
| i18n 英文键 | `app/locales/en.json` | 所有新 UI 文案只加英文 | 开发 |

### 模块依赖关系

```
QuotaManager（EventEmitter，纯 JS）
   ↑ 注入 settings（electron-store）
   ↑ 被 BreaksPlanner 实例化并持有

BreaksPlanner（EventEmitter）
   ├─ 'schedulingMode' === 'classic' → 现有逻辑（零改动）
   └─ 'schedulingMode' === 'quota' → 调用 QuotaManager 查档位 → 路由到 startSoftReminder / startMicrobreak / startBreak
   │
   └─ emit 'startSoftReminder' / 'startMicrobreak' / 'startBreak' / 'updateToolTip' / 'longBreakHardDeadline'
       ↓
main.js（Electron 主进程）
   ├─ 创建 / 关闭 BrowserWindow
   ├─ processWin.showNotification（OS toast）
   ├─ softReminderWin（新）
   └─ appIcon（托盘图标按 quota 档位变色）

Preferences Window（渲染进程）
   ← contextBridge (settings.saveSettings / settings.get)
   ← ipcMain.handle('current-settings')

Soft Reminder Window（渲染进程）
   ← contextBridge（新）soft-reminder-preload.mjs
       - takeBreakNow()
       - postponeTwoMin()
       - ignoreAndClose()
       - getState() → { miniQuota, longQuota, tier, breakType }
   → ipcMain.on('soft-reminder-action', ...)
```

### 关键设计决策

| 决策 | 选择的方案 | 考虑过的替代方案 | 理由 |
|------|-----------|----------------|------|
| Quota 状态放哪 | 独立模块 `QuotaManager`，被 `BreaksPlanner` 组合 | 直接写进 BreaksPlanner | 遵循宪法 §2：Planner 是调度状态机，quota 是独立领域；单独出模块便于单测 |
| 经典与 quota 如何互斥 | `schedulingMode` 字段 + BreaksPlanner 内分支 | 两套 planner 并存 | 并存会出现两个 scheduler 同时 tick 的风险；分支更简单 |
| Quota 持久化机制 | `electron-store` 内存字段 + 关键事件落盘（休息开始/结束、软提醒动作、每日重置） + 退出时最后一次落盘 | 高频 tick 落盘 | 低 IO 开销；符合宪法 §2 性能要求（≤1 Hz，事件驱动） |
| Quota 随时间衰减如何计算 | **懒计算**：只在需要档位判定或持久化时用 `Date.now() - lastActiveTimestamp` 推算当前值；不用 `setInterval` | 每秒 tick | 降耗电（Wayland/macOS power users）；与 `Scheduler.timeLeft` 同样基于时间戳 |
| 档位判定时机 | `BreaksPlanner.nextBreak()` 和 pause/resume 恢复时各查一次；软提醒窗关闭时再查一次 | 持续轮询 | 避免高频决策；档位改变自然触发新的 scheduler |
| 长休硬底线独立 Scheduler | `scheduler.reference = 'longBreakDeadlineTick'`，保活于 BreaksPlanner 一直运行（与 `startMicrobreak` 并行） | 合并到主 scheduler | 硬底线需要在小休期间也累计，不能被小休的 scheduler 清掉；独立 scheduler 更清晰 |
| 持续骚扰模式实现 | 同一个 `longBreakDeadlineTick` scheduler 重排；每次用户拒绝/忽略长休提醒，`k++`，下次 `delay = base / (k+1)`，下限 30s；长休完成 `k=0` 退出 | 切换到独立状态机对象 | 重排延迟比对象切换更轻量，行为等价 |
| 软提醒窗口选型 | Electron `BrowserWindow`（`frame:false`、`alwaysOnTop:true`、`skipTaskbar:true`、`focusable:false` 在可能平台，win32 用 `showInactive()`） | OS toast 代替 | OS toast 只能两按钮、没 quota 条；软窗口给更丰富 UI |
| Wayland 定位 fallback | **检测到 Wayland 时自动退回"屏幕中央 + OS toast 并发"**；不尝试绝对坐标定位 | 硬塞坐标 | 宪法 §2 要求行为一致，Wayland 已知定位受限 |
| 每日重置判定 | 启动时/唤醒时/每次档位查询前：读 `lastResetDate`，若当前时刻已越过本地时区的 `morningHour`，则 reset quota = 100 并更新 `lastResetDate` | 固定时刻定时器 | 机器睡着时定时器不触发；基于时间戳比对更稳 |

---

## 3. 接口定义

### IF-1：QuotaManager 类（`app/utils/quotaManager.js`）

```typescript
interface QuotaConfig {
  // 核心比率：每 workWindowMs 工作 <-> 100% quota
  miniBreakWorkWindowMs: number      // 默认 25*60*1000（Default preset）
  longBreakWorkWindowMs: number      // 默认 120*60*1000
  miniBreakRefillPerMs: number       // 休息 1ms 补多少 quota；= 100 / microbreakDuration
  longBreakRefillPerMs: number       // = 100 / breakDuration
  longBreakBonusToMini: number       // 长休补多少小休 quota（默认 50）
  // 推迟扣减
  ignoreCost: number                 // 忽略/关软窗：默认 5
  postponeCost: number               // 点推迟：默认 10
  redPostponeMultiplier: number      // 🔴档推迟 ×N：默认 2
  // 档位阈值（quota 百分比）
  tierGreenMin: number               // 默认 70
  tierYellowMin: number              // 默认 30
  tierOrangeMin: number              // 默认 10
  // 长休硬底线
  longBreakHardDeadlineMs: number    // 默认 120*60*1000（即 2h 未长休触发）
  harassmentBaseIntervalMs: number   // 默认 10*60*1000
  harassmentMinIntervalMs: number    // 默认 30*1000
}

interface QuotaState {
  miniQuota: number            // 0-100
  longQuota: number
  lastActiveTimestamp: number  // Date.now() 上次"活跃计时"更新时刻
  isFrozen: boolean            // 当前是否冻结（idle/DnD/appExclusion pause）
  lastLongBreakTimestamp: number
  harassmentRejectCount: number
  lastResetDate: string        // ISO date only，如 '2026-04-21'
}

type Tier = 'green' | 'yellow' | 'orange' | 'red'

class QuotaManager extends EventEmitter {
  constructor (settings: Store)

  // === 生命周期 ===
  start (): void                      // 从 electron-store 加载状态；触发一次"每日重置"检查
  stop (): void                       // 持久化当前状态到 electron-store

  // === 冻结/解冻 ===
  freeze (reason: 'idle' | 'dnd' | 'appExclusion' | 'powerSuspend'): void
  unfreeze (reason?: 'idle' | 'dnd' | 'appExclusion' | 'powerSuspend'): void   // reason 仅用于日志；内部不做多源计数

  // === 查询 ===
  getMiniQuota (): number             // 懒计算当前 quota
  getLongQuota (): number
  getTier (breakType: 'mini' | 'long'): Tier
  getConfig (): QuotaConfig           // 读 settings 组装出的当前配置
  getState (): QuotaState             // 只读快照（for preload/UI）

  // === 事件驱动扣减/补充 ===
  onBreakCompleted (breakType: 'mini' | 'long', actualDurationMs: number): void
  onBreakPostponed (breakType: 'mini' | 'long', tier: Tier): void    // 扣 postponeCost；🔴 档 ×redPostponeMultiplier
  onIgnored (breakType: 'mini' | 'long'): void                       // 软窗关闭/不点 toast/到建议时刻未休
  onManualReset (): void                                             // 重置 quota=100

  // === 长休硬底线 ===
  shouldTriggerHardDeadline (): boolean      // 距离 lastLongBreakTimestamp 是否 ≥ longBreakHardDeadlineMs
  onHarassmentRejected (): void              // k++
  getHarassmentIntervalMs (): number         // base / (k+1)，不低于 min

  // === 事件 ===
  // 'tierChanged' → (breakType, oldTier, newTier)
  // 'quotaChanged' → ({ miniQuota, longQuota })
  // 'persistenceRequested' → 主进程监听并落盘（debounced）
}
```

**实现要点**：
- `getMiniQuota()` 内部：若未冻结，用 `Date.now() - lastActiveTimestamp` 乘消耗率推算；若冻结，返回 `_frozenMiniQuota`
- 每次读取 quota 时机会触发"每日重置"检查（基于 `morningHour` 跨日边界）
- 所有写操作（break completed/postponed/ignored）都更新 `lastActiveTimestamp` 到 `Date.now()` 并触发 `'persistenceRequested'`

### IF-2：BreaksPlanner 扩展

```typescript
class BreaksPlanner {
  // 新字段
  schedulingMode: 'classic' | 'quota'
  quotaManager: QuotaManager | null     // quota 模式时非 null
  deadlineScheduler: Scheduler | null   // 长休硬底线；quota 模式时一直运行

  // 新事件
  // 'startSoftReminder' → (breakType: 'mini' | 'long', tier: Tier)
  // 'longBreakHardDeadline' → ()  // 进入持续骚扰
  // 'quotaChanged' → ({ miniQuota, longQuota, miniTier, longTier })  // 给 main.js 刷新托盘

  // 现有事件保持不变：'startMicrobreak' / 'startBreak' / 'finishMicrobreak' / 'finishBreak'
  //                  / 'startMicrobreakNotification' / 'startBreakNotification'
  //                  / 'updateToolTip' / 'resumeBreaks' / 'microbreakStarted' / 'breakStarted'
}
```

**新 Scheduler reference 值**：

| reference | 含义 | 所在阶段 |
|-----------|------|---------|
| `startSoftReminder` | 软提醒窗口即将弹出（🟡/🟠 档） | 工作期间 |
| `softReminderRepeat` | 软提醒窗口被忽略后，下次再弹 | 工作期间 |
| `longBreakDeadlineTick` | 长休硬底线独立 scheduler（quota 模式下常驻） | 任何时刻 |
| `harassmentRepeat` | 持续骚扰模式下的下次弹出 | 持续骚扰期间 |

**Scheduler 分工**：
- 主 `this.scheduler`：当前工作窗/休息窗的计时（和经典模式一致）
- `this.deadlineScheduler`：只跟长休硬底线相关的独立计时器（quota 模式下与主 scheduler 并行）

### IF-3：electron-store schema 扩展

新增字段（都有默认值，v1.20.0 用户升级无需迁移）：

```typescript
// defaultSettings.js 新增
schedulingMode: 'classic' | 'quota'   // 默认 'classic'（opt-in）
quotaPreset: 'relaxed' | 'default' | 'strict' | 'advanced'  // 默认 'default'
// 所有高级参数都存成顶级 key，preset 只在切换时批量设置它们：
miniBreakWorkWindowMs: 1500000        // 25 min (default preset)
longBreakWorkWindowMs: 7200000        // 120 min
longBreakBonusToMini: 50
ignoreCost: 5
postponeCost: 10
redPostponeMultiplier: 2
tierGreenMin: 70
tierYellowMin: 30
tierOrangeMin: 10
longBreakHardDeadlineMs: 7200000      // 120 min
harassmentBaseIntervalMs: 600000
harassmentMinIntervalMs: 30000
softReminderPosition: 'bottomRight'   // 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
softReminderWidth: 360
softReminderHeight: 200
softReminderYellowIntervalMs: 300000   // 🟡 档软提醒间隔，默认 5 min
softReminderOrangeIntervalMs: 120000   // 🟠 档软提醒间隔，默认 2 min
softReminderAutoDismissMs: 90000       // 小窗 90 秒无操作自动消失（AC 7.9/15.0），不扣 quota
// 🟢 档 OS toast（用户决策：on-threshold-cross 为默认；跌破 70% 发一次，🟢 档内完全静默）
greenTierToastMode: 'on-threshold-cross'    // 'silent' | 'on-threshold-cross' | 'periodic'
greenTierToastPeriodicMs: 1200000           // 仅 mode='periodic' 生效，默认 20 min
greenToastUnlockThreshold: 80               // 防抖：quota 必须补至 ≥ 此值，才解锁下次 toast
// Tooltip 前缀（UX-1 兼容 macOS monochrome template icon）
tooltipTierPrefix: 'auto'                   // 'auto' | 'always' | 'never'；默认 'auto'：monochrome 时前缀 [G/Y/O/R]，否则无
resetQuotaShortcut: ''

// 持久状态（运行时写入；电子 store 同时兼做"最近 quota 快照"）
__quotaState__: {
  miniQuota: 100,
  longQuota: 100,
  lastActiveTimestamp: 0,
  lastLongBreakTimestamp: 0,
  lastResetDate: '',
  harassmentRejectCount: 0
}
```

**兼容性承诺**：
- `schedulingMode` 缺省值为 `'classic'` → 老用户升级后行为与 v1.20.0 一致
- `__quotaState__` 缺省为初始快照（全 100%）；首次进入 quota 模式时初始化

### IF-4：软提醒窗口 IPC 契约

**Main → Renderer**：
- `get-soft-reminder-data` ipcMain.handle → 返回 `{ breakType, tier, miniQuota, longQuota, mainColor, miniColor, autoDismissMs }`
- `autoDismissMs` 从 settings `softReminderAutoDismissMs` 读取（默认 90000，即 90 秒）；renderer 用此值而非硬编码，支持用户后续在 advanced 中调整；**注**：T006 交付时 renderer 侧常量化 `AUTO_CLOSE_SECONDS = 90`，T007 接入 main.js 时 payload 必须带此字段，renderer 同步改读

**Renderer → Main**：
- `ipcMain.on('soft-reminder-action', (event, action))`，`action ∈ 'takeNow' | 'postpone' | 'ignore' | 'autoClose'`
- `'takeNow'` → `skipToMicrobreak(100)` 或 `skipToBreak(100)`（按 breakType）
- `'postpone'` → QuotaManager.onBreakPostponed + 重排 scheduler
- `'ignore'` → QuotaManager.onIgnored + 重排 scheduler（使用 `softReminderRepeat` reference）
- `'autoClose'` → **不扣 quota**（AC 7.9），按 `softReminderRepeat` reference 重排下一次提醒（AC 7.10）；语义上等价于"用户未感知"，与 `'ignore'` 的"用户主动放弃"区分开

**窗口关闭（未点任何按钮，非 autoClose 触发路径）** → 视为 `'ignore'`（main.js 监听 `'closed'` 事件兜底；正常路径下 renderer 先发 `'autoClose'` 再关窗，main.js 应对这两条路径去重幂等处理）

### IF-5：软提醒窗口键盘

```
Tab / Shift+Tab — 在三按钮间循环
Enter           — 激活当前按钮
Esc             — 等价于 ignore（关窗）
```

### IF-7：OS toast（🟢 档跌破 + 🟠 档并发）契约

现有 OS toast 实现：
- 主进程 `main.js:showNotification(text)` → 通过 `processWin.webContents.send('show-notification', text, silent)`
- 渲染进程 `app/process-renderer.js` 用 Electron 原生 `new Notification()` 显示 toast；`notification.onclick` 可用（参考 `process-renderer.js:60` 现有"new version"跳转）

**扩展契约**：
- 新增主进程方法：`showQuotaToast(text, kind, silent = false, breakType = null)`（**位置参数**，与现有 `showNotification(text, silent)` 风格一致；T007 实现已采用此签名，为正式契约），`kind ∈ 'greenCross' | 'orangeReminder' | 'miniAvailable' | 'longAvailable'`
  - `processWin.webContents.send('show-quota-toast', { text, kind, silent, breakType })`
- 渲染进程新增 IPC handler `stretchly.onShowQuotaToast((text, kind, silent, breakType) => { ... })`（加到 `context-bridge-exposers.js:exposeStretchly()`）
  - 根据 `kind` 决定 `notification.onclick` 行为：
    - `'orangeReminder' | 'miniAvailable' | 'longAvailable'` → `onclick` 发 `ipcRenderer.send('soft-reminder-action', 'takeNow')` 等效调用（或复用新 IPC `ipcRenderer.send('quota-toast-take-now', breakType)`）
    - `'greenCross'` → 无 onclick（纯告知）
- 主进程 `ipcMain.on('quota-toast-take-now', (event, breakType))` → `skipToMicrobreak(100)` 或 `skipToBreak(100)`

**🟢 档跌破防抖状态机**（QuotaManager 内部维护）：
- state: `greenToastArmed: boolean`（初始 true）
- 跌破 `tierGreenMin`（默认 70）触发 toast，`greenToastArmed = false`
- quota 补至 ≥ `greenToastUnlockThreshold`（默认 80）时 `greenToastArmed = true`
- `greenTierToastMode === 'periodic'`：忽略 armed 机制，按 `greenTierToastPeriodicMs` 固定周期发

### IF-6：跨模块约定

- 所有时间戳使用 `Date.now()`（毫秒）；所有持久化时间戳存毫秒整数；`lastResetDate` 存本地时区 ISO 日期字符串 `'YYYY-MM-DD'`
- QuotaManager 不触碰 Electron API（便于 vitest 纯 JS 测试；仅读 settings）
- 所有新 i18n 键放在 `en.json` 顶级下 `quota.*`（如 `quota.softReminder.title` / `quota.softReminder.takeNow`）
- 日志前缀遵循宪法 §4：`Stretchly: quota tier changed: mini yellow → orange (45 → 25)`

---

## 4. 边界情况

| # | 场景 | 关联接口/模块 | 预期行为 |
|---|------|-------------|---------|
| 1 | 用户从未启用 quota 模式 | BreaksPlanner, QuotaManager | `schedulingMode==='classic'` 下 QuotaManager 不实例化；无任何新代码路径生效 |
| 2 | 用户切换到 quota 模式但 `microbreak=false` 或 `break=false` | QuotaManager | 对应那路 quota 停止消耗（工作不消耗、休息不补充、档位始终 green） |
| 3 | 机器在 quota < 10% 时进入 idle/DnD/appExclusion pause | QuotaManager.freeze | quota 冻结在当前值；不触发新的软提醒/红档；恢复后从冻结值继续 |
| 4 | 机器休眠 6 小时后唤醒 | powerMonitor 'resume' → BreaksPlanner.correctScheduler + QuotaManager.unfreeze | 唤醒时先做 daily reset 检查；若跨过 morningHour → quota 重置；否则用冻结值继续 |
| 5 | 跨清晨 morningHour 边界时机器是开机状态 | QuotaManager.getMiniQuota | 懒计算时检测 `lastResetDate !== today` → 重置为 100% 并更新 `lastResetDate` |
| 6 | 软提醒窗弹出时用户正在长休 | BreaksPlanner | Planner 在 scheduler.reference === 'finishBreak'/'finishMicrobreak' 时不触发新 softReminder（遵循现有 guard） |
| 7 | 红档推迟被 strictMode 禁止 | break-renderer.js / QuotaManager | `breakStrictMode === true` → 全屏窗不渲染推迟按钮（与现有行为一致）；不扣 quota |
| 8 | Wayland 环境（Linux + `XDG_SESSION_TYPE === 'wayland'`） | main.js 软窗口创建 | 检测到 Wayland → 软窗口居中显示 + 同时触发一次 OS toast；不尝试绝对坐标 |
| 9 | 多显示器 + fractional scaling | main.js 软窗口定位 | 用 `screen.getPrimaryDisplay().workArea` 或设置中选定的 display，基于 `workArea` 的 `x+width - winW - margin` 计算 |
| 10 | 持续骚扰模式下被 DnD/appExclusion 冻结 | QuotaManager.freeze + BreaksPlanner.deadlineScheduler | 冻结期间 deadlineScheduler 取消；恢复后用剩余时间重排；`harassmentRejectCount` 保留 |
| 11 | 连续工作 3 天未重启（跨 3 个 morningHour） | QuotaManager | 只 reset 一次（当前日期 > lastResetDate 即 reset；不补偿过往） |
| 12 | electron-store 中 `__quotaState__` 字段结构损坏（手动编辑破坏） | QuotaManager.start | try/catch → 回退到初始快照（全 100%）并记 `log.warn` |
| 13 | 软提醒窗口的三按钮和 OS toast 并发（🟠 档） | main.js | 软窗口关闭时主动消除 toast（无 API 可直接 dismiss toast → 接受 UX 缺陷，toast 由 OS 自然淡出） |
| 14 | 主 scheduler 已在 `finishMicrobreak` 时 quota 档位变化 | BreaksPlanner.quotaChanged | 不打断当前休息；休息结束后 `nextBreak()` 会重新查档位 |
| 15 | 用户在 advanced 里把 `ignoreCost > 100` | QuotaManager.onIgnored | quota 一次扣到 0；档位立即跳 red；无崩溃（clamp 到 0） |
| 16 | 长休硬底线正好在小休进行中触发 | BreaksPlanner.deadlineScheduler | 小休结束后立刻进入长休（跳过继续工作阶段） |

---

## 5. 任务分解

> worktree 创建方式：在每个任务开始前，架构师执行 `git worktree add -b feat/T<NNN>/<desc> worktrees/T<NNN> trunk`

| # | 任务 | 涉及文件 | model | worktree | 依赖 | 复杂度 | testing | 状态 |
|---|------|---------|-------|----------|------|--------|---------|------|
| T001 | defaultSettings + electron-store schema 扩展（所有 quota 新字段 + `__quotaState__`）；不改任何行为 | `app/utils/defaultSettings.js` | sonnet | worktrees/T001/ | 无 | 低 | atdd | 待开始 |
| T002 | `QuotaManager` 核心实现（类 + 事件 + 懒计算 + 持久化请求） | `app/utils/quotaManager.js` | opus | worktrees/T002/ | T001 | 高 | atdd | 待开始 |
| T003 | `QuotaManager` 单元测试（fake timers 覆盖 0/100/冻结/重置/硬底线/档位切换） | `test/quotaManager.js` | sonnet | worktrees/T002/（技术 QA 共用） | T002 | 中 | （伴随 T002 atdd） | 待开始 |
| T004 | BreaksPlanner 升级：新增 `schedulingMode` 分支 + 集成 QuotaManager + `deadlineScheduler` + 新事件 `startSoftReminder` / `longBreakHardDeadline` / `quotaChanged` + pause/resume 链路通知 QuotaManager 冻结/解冻 | `app/breaksPlanner.js` | opus | worktrees/T004/ | T002 | 高 | atdd | 待开始 |
| T005 | BreaksPlanner 测试回归 + quota 模式下的 planner 行为单测 | `test/breaksPlanner.js`（新建） | sonnet | worktrees/T004/ | T004 | 中 | （伴随 T004 atdd） | 待开始 |
| T006 | 软提醒窗口 — HTML + CSS + Renderer + Preload | `app/soft-reminder.html`, `app/soft-reminder-preload.mjs`, `app/soft-reminder-renderer.js`, `app/css/soft-reminder.css`, `app/utils/context-bridge-exposers.js` | sonnet | worktrees/T006/ | 无 | 中 | post | 待开始 |
| T007 | main.js 集成软提醒窗口：监听 `startSoftReminder` / `longBreakHardDeadline` 打开 `softReminderWin`；响应 IPC **四个 action**（`'takeNow'`/`'postpone'`/`'ignore'`/`'autoClose'`，详见 IF-4；`'autoClose'` 不扣 quota）；`get-soft-reminder-data` 返回值含 `autoDismissMs`（读 `settings.get('softReminderAutoDismissMs')`，默认 90000）；**接入时必须将 T006 renderer 的硬编码常量 `AUTO_CLOSE_SECONDS = 90` 替换为从 payload 读取 `state.autoDismissMs / 1000`**；Wayland fallback；powerMonitor 触发 QuotaManager.freeze/unfreeze；process-renderer 接入 `onShowQuotaToast` 弹出 OS toast（IF-7）并实现点击回调 | `app/main.js`, `app/soft-reminder-renderer.js`（硬编码转 payload，小改）, `app/process-renderer.js`（toast 接入） | opus | worktrees/T007/ | T004, T006 | 高 | post | 待开始 |
| T008 | 托盘图标 quota 档位变色 + tooltip 两行文本 | `app/utils/appIcon.js`, `app/main.js`, `app/utils/statusMessages.js` | sonnet | worktrees/T008/ | T004 | 低 | post | 待开始 |
| T009 | Preferences UI：调度模式单选 + Quota 分区（3 preset + 高级折叠） + 条件隐藏老的 postponesLimit 等 | `app/preferences.html`, `app/preferences-renderer.js`, `app/preferences-preload.mjs`, `app/css/preferences.css` | sonnet | worktrees/T009/ | T001 | 中 | post | 待开始 |
| T010 | 命令与快捷键：托盘菜单"重置 quota"、`resetQuotaShortcut` 注册、`stretchly reset-quota` 二级实例命令 | `app/utils/commands.js`, `app/utils/breakShortcuts.js`, `app/main.js` | sonnet | worktrees/T010/ | T004 | 低 | post | 待开始 |
| T011 | 英文 i18n 新键（`quota.*` 全量） | `app/locales/en.json` | sonnet | worktrees/T011/ | 无 | 低 | none | 待开始 |
| T012 | break/microbreak renderer 的红档推迟 2× 扣费提示 + 复用扣费逻辑 | `app/microbreak-renderer.js`, `app/break-renderer.js`, `app/utils/context-bridge-exposers.js`（如需传 tier） | sonnet | worktrees/T012/ | T004, T006 | 低 | post | 待开始 |

**共 12 个任务**。T003、T005 与对应主任务共用 worktree（技术 QA 使用 developer 的分支做测试）。

**testing 列说明**（保留）：`atdd` = 测试先行，`post` = 测试后行，`none` = 无自动化测试。

### 共享文件管理

| 文件 | 涉及任务 | 合并策略 |
|------|---------|---------|
| `app/main.js` | T007, T008, T010 | **策略 B（串行合并）**：顺序 T004 → T007 → T008 → T010；每个后序任务合并前 `git rebase trunk`。main.js 改动点清晰隔离（软窗口 handler / tray hook / commands 注册），冲突面积小 |
| `app/utils/defaultSettings.js` | T001 独占 | **策略 A（单任务独占）**：所有新 key 由 T001 一次性加入，其他任务只读 |
| `app/utils/context-bridge-exposers.js` | T006, T007, T012 | **策略 B（串行合并）**：T006 先合入（新增 `exposeSoftReminder()`）；T007 合入时 rebase 并在 `exposeStretchly()` 加 `onShowQuotaToast`；T012 最后合入时 rebase 并按需扩展 `exposeBreaks` |
| `app/css/preferences.css` | T009 独占 | **策略 A** |
| `app/breaksPlanner.js` | T004 独占 | **策略 A** |
| `test/breaksPlanner.js` | T005 独占（新建） | **策略 A** |
| `app/locales/en.json` | T011 独占（各任务在代码中使用 key，T011 统一添加英文值） | **策略 A（集中添加）**：其他任务的 developer 只在代码中使用 `quota.*` 键，不碰 locale 文件；T011 最后合入前，架构师向 T011 提供一份"所有用到的 key"清单 |

### 集成检查清单

所有任务合并到 trunk 后、启动产品 QA 前，架构师执行以下检查：

| # | 检查项 | 验证方式 | 关联任务 |
|---|--------|---------|---------|
| 1 | `schedulingMode === 'classic'` 时 QuotaManager 未实例化 | grep `new QuotaManager` → 确认仅在 quota 分支内调用；冷启动一次经典模式观察日志 | T002, T004 |
| 2 | 所有新增 i18n 键都存在 en.json | 跑 `npm start`，切到 quota preferences tab，查 console 是否有 i18next "missing key" 警告 | T009, T011 |
| 3 | 新增 settings 字段都在 defaultSettings 有默认值 | grep `settings.get('…')` 的新 key 在 `defaultSettings.js` 中有对应键 | T001, T007, T009 |
| 4 | 软提醒窗口 IPC 在 main 和 preload 两端都接入 | grep `ipcMain.on('soft-reminder-action'`、`exposeSoftReminder` 都存在 | T006, T007 |
| 5 | BreaksPlanner 新事件在 main.js 都有监听 | grep `breakPlanner.on('startSoftReminder'`, `'longBreakHardDeadline'`, `'quotaChanged'` | T004, T007, T008 |
| 6 | pause/resume 链路（`dndStarted` / `clearBreakScheduler` / `appExclusionStarted`）都调用 QuotaManager.freeze/unfreeze | grep `quotaManager.freeze` / `.unfreeze` 覆盖四条链路 | T004 |
| 7 | 经典模式回归：切回经典后 microbreak/break 计时与 v1.20.x 行为一致（手动 5 分钟冒烟） | 手动：切经典 → 设小休 interval=60000 → 等待 → 观察 OS toast + 小休窗正常弹出；重复一次长休 | All |
| 8 | 托盘 quota tooltip 文案行数 | 打开 quota 模式，鼠标悬停托盘图标，tooltip 应包含 `Mini: XX%` 和 `Long: XX%` 两行 | T008 |
| 9 | 软提醒窗口键盘操作 | 手动触发软提醒（把 interval 调极短），验证 Tab/Enter/Esc 行为 | T006 |
| 10 | Wayland fallback（仅 Linux 环境可验；其他平台跳过） | `XDG_SESSION_TYPE=wayland npm start`（Linux）→ 软提醒时应居中而非右下角 | T007 |
| 11 | `npm run lint` 通过 | `npm run lint` | All |
| 12 | `npm test` 通过 | `npm test` | All |

### 并行化

**可并行**：
- T001（独立）
- T006（纯 UI，与 T002/T004 无文件冲突）
- T011（i18n，独立文件）

**必须串行**：
- T002 → T004 → T005
- T004 → T007, T008, T010（共享 main.js）
- T007 依赖 T006（软窗口 preload 先存在）
- T004 + T006 → T012（红档扣费需要 quota 状态 + 软窗口上下文）

**推荐并行批次**：
- **Batch 1**（启动）：T001、T006、T011 并行
- **Batch 2**（T001 完成后）：T002 + T009 并行
- **Batch 3**（T002 完成）：T003（QA）+ T004（开发）并行
- **Batch 4**（T004 完成）：T005、T007、T008、T010、T012 按共享文件策略串行合并

---

## 6. Git 工作流

### Worktree 设置

```bash
# 架构师在每个任务开始前执行（示例 T001）
cd /Users/yxang/GitMine/stretchly
mkdir -p worktrees
git worktree add -b feat/T001/default-settings worktrees/T001 trunk

# 任务合并后清理
git worktree remove worktrees/T001
git worktree prune
```

### 分支命名

```
feat/T001/default-settings
feat/T002/quota-manager
feat/T003/quota-manager-tests      (技术 QA 在 T002 worktree 内做；分支可复用 feat/T002/*)
feat/T004/planner-quota-mode
feat/T005/planner-tests            (同上，复用 feat/T004)
feat/T006/soft-reminder-window
feat/T007/main-soft-reminder-integration
feat/T008/tray-quota-visualization
feat/T009/preferences-quota-ui
feat/T010/commands-and-shortcuts
feat/T011/i18n-english
feat/T012/red-tier-postpone-cost
```

### 文件所有权

| 开发 | 负责的文件/目录 | 不得触碰 |
|------|----------------|---------|
| T001 开发 | `app/utils/defaultSettings.js` | 其他文件 |
| T002 开发 | `app/utils/quotaManager.js` | 其他模块主体 |
| T003 QA | `test/quotaManager.js`（新建） | app/ 源码 |
| T004 开发 | `app/breaksPlanner.js` | main.js/utils |
| T005 QA | `test/breaksPlanner.js`（新建） | app/ 源码 |
| T006 开发 | `app/soft-reminder.html/-renderer.js/-preload.mjs`、`app/css/soft-reminder.css`、`app/utils/context-bridge-exposers.js`（仅追加 `exposeSoftReminder`） | 其他 |
| T007 开发 | `app/main.js`（软窗口相关段 + powerMonitor 钩子 + `showQuotaToast` + `quota-toast-take-now` IPC）、`app/process-renderer.js`（扩展 `onShowQuotaToast` + notification.onclick） | planner 内部 |
| T008 开发 | `app/utils/appIcon.js`, `app/utils/statusMessages.js`, `app/main.js`（仅 tray 段） | 其他 |
| T009 开发 | `app/preferences.html`, `app/preferences-renderer.js`, `app/preferences-preload.mjs`, `app/css/preferences.css` | 其他 |
| T010 开发 | `app/utils/commands.js`, `app/utils/breakShortcuts.js`, `app/main.js`（仅命令/快捷键注册段） | 其他 |
| T011 开发 | `app/locales/en.json` | 其他 |
| T012 开发 | `app/microbreak-renderer.js`, `app/break-renderer.js`, `app/utils/context-bridge-exposers.js`（仅扩展 `exposeBreaks` 如必要） | 其他 |

---

## 7. 模型分配

**项目复杂度评估**：**中高**。

**理由**：
- 核心新增是一套有状态 + 持久化 + 冻结/解冻 + 懒计算 + 档位判定 + 硬底线的状态机（QuotaManager），错一个边界条件用户就感知错乱
- BreaksPlanner 本身是现有 app 的神经中枢，改动需精确——额外路径必须与经典分支严格隔离，否则引入回归
- 主进程/渲染进程 IPC 契约 + Wayland 特殊处理 + 跨平台窗口定位，需要反复权衡
- 其他任务（i18n、托盘图标、命令注册）是常规实现

**覆盖默认的角色**：

| 角色 | 默认 | 本项目 | 理由 |
|------|------|--------|------|
| 开发（T002 QuotaManager） | Sonnet | **Opus** | 核心状态机，边界条件密集；返工风险极高 |
| 开发（T004 BreaksPlanner 升级） | Sonnet | **Opus** | 中枢改造，需同时理解现有代码 + 新分支 + 零回归约束 |
| 开发（T007 main.js 集成） | Sonnet | **Opus** | 跨多个子系统（软窗口/powerMonitor/Wayland/IPC）+ 易引入回归 |
| 开发（其他 sonnet 任务） | Sonnet | Sonnet（默认） | 常规实现 |
| Code Reviewer | Sonnet | Sonnet（默认） | CR 每任务独立启动，负担可控 |
| 技术 QA | Sonnet | Sonnet（默认） | 测试桩 + 边界覆盖，Sonnet 足够 |
| 架构师 | Opus | Opus（默认） | |

---

## 8. 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| Wayland 软窗口定位偏位 | 中 | 中 | 设计 fallback：检测到 `XDG_SESSION_TYPE=wayland` 自动居中 + OS toast 双发；在 §9 手动测试覆盖 |
| 经典模式回归（修改 BreaksPlanner 时波及） | 中 | 高 | T004 必须保证 `schedulingMode === 'classic'` 时走纯原有代码路径；T005 全量回归现有测试；集成检查 §5.7 手动冒烟 |
| QuotaManager 持久化时机太频繁导致 IO 抖动 | 低 | 中 | debounce 1s；事件驱动而非 tick；宪法 §5 "≤1 Hz" |
| quota 懒计算在机器休眠长时间后溢出 | 低 | 中 | 每次 getQuota 前先跑冻结/解冻判定；clamp [0, 100]；持久化 `lastActiveTimestamp` 时也写入 `lastResetDate` |
| 长休硬底线的 deadlineScheduler 与主 scheduler 状态冲突（都在 finishBreak 切换时 tick） | 中 | 中 | deadlineScheduler 只 emit 'longBreakHardDeadline' 事件，不碰主 scheduler；main.js 收到事件后判断是否真要进入 harassment（有其他破解路径则忽略一次） |
| 软提醒窗口 frameless + alwaysOnTop + focusable:false 组合在 Linux 下显示异常 | 中 | 低 | 先用保守参数，Linux 下 `focusable:true` + `skipTaskbar:true`；手动冒烟验证 |
| 红档时仍允许推迟但 strictMode=on 的语义冲突 | 低 | 低 | 明确：strictMode=on 优先级高于 quota；全屏窗不渲染推迟按钮；`onBreakPostponed` 不被调用 |
| electron-store 的 `watch` 选项对新增 `__quotaState__` 字段的变更触发 log 洪水 | 低 | 低 | 用 `settings.set('__quotaState__', …, { skipWatch: false })`；若噪音明显再 debounce log 层面 |
| preferences "3 preset + 高级折叠"的联动（preset 切换要批量覆盖高级参数）写错 | 中 | 中 | T009 需实现明确的 `applyPreset(name)` 函数，单次写入全组值；advanced 折叠展开只读显示，不反向推导 preset 名（改动就标记 `quotaPreset='advanced'`） |
| 用户在产品 QA 期间多次切换 schedulingMode 触发状态残留 | 低 | 中 | 切到 classic 时 QuotaManager.stop() 持久化；切回 quota 时重新 start() 读回状态；经典模式不触发任何 quota 事件 |

---

## 9. 验证策略

### 单元测试
- 框架：vitest（现有），`test/` 目录镜像
- 新增：
  - `test/quotaManager.js` — 覆盖 0/100/溢出、冻结/解冻、每日重置、档位切换、推迟/忽略扣减、硬底线触发/退出、harassment 间隔递减、fake timers
  - `test/breaksPlanner.js`（新建，当前未有） — `schedulingMode === 'quota'` 下的事件顺序、pause/resume 链路通知 QuotaManager、经典模式零回归对比
- 覆盖率目标：QuotaManager ≥ 90%；BreaksPlanner 新增分支 ≥ 80%

### 集成测试
- 冒烟：`npm start` 跑起来，按集成检查清单手动过一遍
- 不做 Electron 自动化集成测试（现有项目也没有 Spectron）

### 端到端 / 产品测试
- 手动 QA（本项目是桌面 app，无 web URL 可 playwright）
- 关键流程清单（由产品 QA 执行）：
  1. 冷启动（新用户）→ 默认经典模式，与 v1.20.0 行为一致
  2. preferences 切换到 quota → 观察托盘立即 green；调 `miniBreakWorkWindowMs=60000`（1min）观察衰减
  3. Quota 降到 yellow（30-70%）→ 软提醒窗在右下角弹出；Tab/Enter/Esc 行为正确
  4. 软窗"+2 分" → quota 扣 postponeCost，schedule 重排 +120s
  5. Quota 降到 red（<10%）→ 全屏 break 窗；推迟扣费是 20（2×10）
  6. 长时间工作（大于 longBreakHardDeadlineMs；可调低）→ 进入"持续骚扰"，连续拒绝 3 次观察间隔递减到 < 60s
  7. 锁屏/suspend 30min 恢复 → quota 未变化；恢复后 5 秒内 scheduler 正常
  8. 托盘"重置 quota"菜单 → 两路 quota 回到 100；托盘图标变 green
  9. 切回经典模式 → 所有 quota UI 隐藏；行为与 v1.20.0 一致
  10. 跨午夜（手动改系统时间）→ 重启后 quota 回到 100（跨过 morningHour 边界）

### E2E 验证标注规则

本项目**无外部 API、SDK、数据源集成**——纯本地 Electron 状态机。所有任务 testing 列使用 `atdd` / `post` / `none`，不标注 `e2e`。

### 共享资源分配

本项目为桌面 app，无"模拟器/浏览器实例"类共享资源。验证在架构师本机（macOS）执行；Wayland 手动 check 如果用户有 Linux 环境则另行验证。

| 资源类型 | 分配给 | 实例标识 | 启动方式 |
|---------|--------|---------|---------|
| Stretchly 主进程（自用机） | 产品 QA | 架构师本机进程 | `npm start` |

（若架构师与产品 QA 是同一用户 session → 串行使用；无并发需求）

### 开发自验证（请求 CR 前）

```
npm run lint       # StandardJS 通过
npm test           # vitest 通过
npm start          # 冷启动无崩溃，自己任务范围的行为至少冒烟一次
阅读自己的 diff，确认无遗漏、无裸 console.log、无注释掉的旧代码
```

### 自动 Lint Hook（PostToolUse）

Stretchly 已有 StandardJS 工具链 + husky pre-commit hook 跑 `npm run lint`。建议在 `.claude/settings.json` 配置 PostToolUse hook，对每次 `Write` / `Edit` 自动跑 `npx standard --fix`：

```jsonc
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "cd /Users/yxang/GitMine/stretchly && npx standard --fix \"$FILE\" 2>&1 | tail -n 20 || true"
      }
    ]
  }
}
```

> `|| true` 防止 lint 失败打断 agent；CR 阶段会再跑一次作为硬门槛。

### 验证命令

```bash
# 测试
npm test

# Lint
npm run lint

# 单文件测试
npx vitest run test/quotaManager.js

# 冒烟运行
npm start

# 打包（可选，最后验证）
npm run pack
```

---

## 10. 未解决问题

| # | 问题 | 状态 | 解决方案 |
|---|------|------|---------|
| 1 | 3 个 preset 的 x:y 具体数值 | `[NEEDS CLARIFICATION]` | Plan 建议 Relaxed `30:5`、Default `25:5`、Strict `20:5`；已**在 defaultSettings 采用 plan 建议值**作为默认；需 Product Lead 最终拍板 |
| 2 | quota 满额的基准语义 | 已定 | **100% = 1 个工作周期 `workWindowMs` 消耗至 0**（plan 建议 #2 采纳） |
| 3 | 长休额外补小休 quota 的比例 | `[NEEDS CLARIFICATION]` | 默认 `longBreakBonusToMini = 50`（plan 建议）；Product Lead 可改 |
| 4 | 长休硬底线 N 的默认 | 已定 | `longBreakHardDeadlineMs = 7200000`（120min，plan 建议 #4）；advanced 可调 |
| 5 | "持续骚扰"的终止与退出 | 已定 | 长休完成 → `harassmentRejectCount = 0` 退出；DnD/idle/appExclusion → 冻结 deadlineScheduler；解冻后重排（保留 rejectCount） |
| 6 | 软提醒小窗在 Linux/Wayland 定位 | 已定 | 检测 `process.env.XDG_SESSION_TYPE === 'wayland'` → 居中 + OS toast 双发；否则右下角 |
| 7 | strictMode 在 quota 模式下的语义 | 已定 | `microbreakStrictMode` / `breakStrictMode = true` → 🔴 档禁止推迟（现有全屏窗 strict 行为直接生效，`onBreakPostponed` 不调用） |
| 8 | postponesLimit / postponableDurationPercent 在 quota 模式下 | 已定 | Quota 模式下不使用；preferences 条件隐藏；store 字段保留便于切回经典 |
| 9 | i18n 新键数量 | 已定 | 架构师在 T011 合入前汇总所有 `quota.*` 键清单（估计 20-30 条）；只加英文 |
| 10 | `showNotification` 是否能在红档 toast 并发时避免卡顿 | 已定 | 现有 `showNotification` 已被 `silentNotifications` 控制；不做新增 rate-limit（自用场景下可接受短时并发） |
| 11 | 软窗 renderer 是否需要 i18next | 已定 | 用与其他窗口相同的 `i18next` contextBridge（见 `context-bridge-exposers.js` 的 `exposeI18next`）；只加载 en |
| 12 | 每日重置使用哪种时区 | 已定 | **本地时区**；`lastResetDate` 存 `DateTime.now().toISODate()`（luxon 已引入） |
| 13 | quota 模式下 `microbreakNotification` 预告是否保留 | 已定 | **Quota 模式下不使用现有 "notification before break" 机制**——`startSoftReminder` 完全替代；quota 模式下 `breakNotification` / `microbreakNotification` 的 UI 控件隐藏 |
| 14 | 🟢 档 OS toast 触发规则 | 已定（用户决策） | `greenTierToastMode = 'on-threshold-cross'`：跌破 `tierGreenMin`（默认 70）时发一次，🟢 档内完全静默；**防抖**：quota 必须补至 ≥ `greenToastUnlockThreshold`（默认 80）才解锁下次 toast。`'periodic'` 模式保留作为可选（默认 20min 间隔），`'silent'` 模式完全不发 |
| 15 | 🟡/🟠 档软提醒间隔 | 已定（用户决策） | 🟡 `softReminderYellowIntervalMs = 300000`（5min）；🟠 `softReminderOrangeIntervalMs = 120000`（2min） |
| 16 | 持续骚扰 base 间隔 | 已定（用户决策） | `harassmentBaseIntervalMs = 600000`（10min）— 与原 IF-3 默认一致 |
| 17 | macOS monochrome tray icon 色彩丢失 | 已定（UX-1 答复） | 在 tooltip 中加 tier 前缀 `[G]/[Y]/[O]/[R]`；新增 `tooltipTierPrefix: 'auto' \| 'always' \| 'never'`，默认 `'auto'`（仅 `useMonochromeTrayIcon=true` 时前缀生效） |
| 18 | 🟠 档 OS toast 点击回调能否触发"Rest now" | 已定（UX-4 答复） | **可行**。`processWin` 渲染进程使用 Electron 原生 `Notification`，`.onclick` 已在 `process-renderer.js:60` 用于 "new version" 跳转 → 同样机制可用于 quota toast。实现路径见 §3 IF-7 新增接口 |
| 19 | `microbreakDuration` 在 classic / quota 模式下语义是否需要分离 | 已定（架构师 2026-04-24 裁定） | **不分离，保持单字段**。理由：(a) quota 模式下 `miniBreakRefillPerMs = 100 / microbreakDuration` 语义是"1 次完整小休补 100% mini quota"，与 classic 模式"休息 N 秒"自洽；(b) 新增字段会增加 preferences UI 复杂度；(c) 若后续用户诉求分离，可在 v1.22+ 增 `quotaMiniBreakRestDurationMs`。**acceptance**：QuotaManager 已实现的 `microbreakDuration` 作 refill 分母的行为视为契约。 |
| 20 | `QuotaManager.freeze/unfreeze` 多源调用是否需要计数 | 已定（架构师 2026-04-24，由 T007 CR 引出） | **不计数，仅用 `reason` 作日志语义**。powerMonitor / idle / DnD / appExclusion 可叠加，`freeze` 幂等（已冻结再冻结 no-op），`unfreeze` 不区分源直接解冻。Trade-off：粗粒度，但覆盖所有 session，简单可靠；复杂化到计数会引入状态漂移风险。**acceptance**：`freeze` 签名枚举新增 `'powerSuspend'`（见 IF-1，T007 实现已采用）。 |
| 21 | `showQuotaToast` 签名形式（对象 vs 位置参数） | 已定（架构师 2026-04-24，由 T007 实现引出） | **位置参数** `showQuotaToast(text, kind, silent = false, breakType = null)`，与项目既有 `showNotification(text, silent)` 风格一致。原契约 `{ text, kind }` 对象形式作废；IF-7 已更新。**acceptance**：T007 实现即正式契约，后续 T008/T010 如需新增 kind 不改变签名。 |

> 标记 `[NEEDS CLARIFICATION]` 的项（#1、#3）已采用 plan 建议值作为代码默认，交付后由 Product Lead 在运行时调优；技术实现不阻塞。

---

## 当前状态

**v1.21 Phase 6 完成**（2026-04-29 更新）。所有任务 + AC 15.7 hotfix + close-out docs + T018 help UI 合并到 dev，PQ 第一轮 + T018 smoke 全通过。

### 已合并到 dev（全量）

| 任务 | Merge commit | 描述 |
|------|-------------|------|
| T001 | `da889ad` | defaultSettings + electron-store schema 扩展 |
| T006 | `4b3a6d4` | 软提醒窗口 UI（HTML + CSS + preload + renderer） |
| T009 | `8527599` | Preferences UI（调度模式 + preset + advanced 折叠） |
| T011 | `e7da36d` | 英文 i18n 新键（51 条 `quota.*`） |
| T002+T003 | `74f59da` + `a4dcf77` | QuotaManager 核心 + 单测 |
| T004+T005 | `3b74c67` | BreaksPlanner quota 模式 + 测试 |
| T012 | `01e9a09` | break/microbreak renderer 红档推迟 2× 提示 |
| T007 | `14f47f4` | main.js 集成软提醒 + Wayland fallback + powerMonitor 钩子 |
| T008 | `12504bd` | 托盘 quota tooltip + progress 图标复用 |
| T010 | `7c35e65` | reset-quota tray menu + shortcut + CLI |
| Hotfix AC 15.7 | `8ce7a0a` | QuotaManager `_sanitizeTierThresholds()` all-or-nothing γ + cascade clamp |
| Close-out docs | `5bf9fb3` | docs(v1.21) close-out + Quota Mode user help（README + en.json + knowledge） |
| T018 | `d098d9d` | Quota tab help UI（preferences.html `<details>` 折叠 + preferences.css） |

**dev HEAD = `d098d9d`**

### Phase 6 close-out 验证状态

- **集成 checklist**：代码层 9/12 自动 PASS；运行时 #7/#9/#10 并入 PQ
- **PQ 第一轮**：47 AC + AC 15.6 + AC 15.7 全通过（PL 已确认）
- **全项目测试**：`npx vitest run test/` → 404/404 tests PASS（7 文件 Electron binary 启动失败为环境问题，与 AC 无关）
- **ACCEPTANCE.md:457 文案** revise 已落地（PL 主导）
- **T018 smoke PASS**（PL 4 项 grep + AC 18.3 L4 写入 ACCEPTANCE.md 功能 18 + 人工验证手册步骤 4/5）

### 跨 Phase 遗留（下一版本或 L4 用户自测时处理）

- **#7 classic 回归** + **#9 软提醒键盘（Tab/Enter/Esc）**：L4 用户自测待做，时机由 PL 建议
- **#10 Wayland fallback**：N/A on macOS；后续 Linux 环境回归时补测
- **T006 产品 QA**：已随 PQ 第一轮完成

### 关键接口契约（保留给下一版本参考）

- **IF-1**：`freeze(reason)` 枚举 = `'idle' | 'dnd' | 'appExclusion' | 'powerSuspend'`；`unfreeze(reason?)` 可选参数仅用于日志
- **IF-7**：`showQuotaToast(text, kind, silent = false, breakType = null)` 位置参数
- **i18n**：`quota.*` 51 键 + `quota.softReminder.title = "Break reminder"` 落地
- **AC 15.7 契约**：`_sanitizeTierThresholds()` 策略 = 原始值有非有限 / ≤0 → 全组 fallback 到 (70,30,10)；原始全有效但逆序 → cascade clamp（yellow<green, orange<yellow，级联到 0 时整组 fallback）

### Phase 6 未解决问题 → 无

Phase 6 完成，无技术债务转入下一 Phase。合并基线：dev 分支 **`d098d9d`**。下一版本开始前先 rebase 此 HEAD。

---

## 范围挑战

### 步骤 0 — 数据假设验证

| # | 数值假设 | 来源 | 验证结果 |
|---|---------|------|---------|
| 1 | `microbreakInterval` 默认 600000ms（10min）| defaultSettings.js:7 | ✅ 已 grep 确认 |
| 2 | `breakInterval` 默认 2（每 3 次小休一次长休）| defaultSettings.js:9 | ✅ 已确认，与 plan 一致 |
| 3 | `morningHour` 默认 6 | defaultSettings.js:18 | ✅ 已确认 |
| 4 | plan §3.1#9 建议 N=120min | plan 已知风险 #4 | ✅ 直接采纳为 `longBreakHardDeadlineMs=7200000` |
| 5 | plan §3.1#2 "quota 0-100" | plan 正文 | ✅ 直接用，无歧义 |
| 6 | plan §3.1#4 长休补小休 50% | plan 建议 #3 | ✅ 直接用作默认 `longBreakBonusToMini=50` |
| 7 | `breakDuration` 默认 300000ms（5min） | defaultSettings.js:8 | ✅ 已确认 |
| 8 | `microbreakDuration` 默认 20000ms（20s） | defaultSettings.js:6 | ✅ 已确认 |

无 `[NEEDS VERIFICATION]` 项。

### 步骤 1+2+3 — 每功能评估

| # | 功能（来源） | 当前版本必要性 | 投入产出比 | 结论 |
|---|------|-------------|-----------|------|
| 3.1#1 调度模式开关 | 必要 | 高 | **保留** — 没这个就没法 opt-in，所有新代码无处栖身 |
| 3.1#2 独立双 quota | 必要 | 高 | **保留** — 核心机制 |
| 3.1#3 工作消耗 | 必要 | 高 | **保留** |
| 3.1#4 休息补充（含长休补小休） | 必要 | 高 | **保留** |
| 3.1#5 推迟扣 quota | 必要 | 高 | **保留** — 没有"代价"弹性就等于放弃 |
| 3.1#6 4 档提醒升级 | 必要 | 高 | **保留** — Plan 的核心体验 |
| 3.1#7 角落软提醒小窗 | 必要 | 中 | **保留** — 🟡/🟠 档没替代品，OS toast 无法显示 quota 条+3 按钮 |
| 3.1#8 红档推迟 2× | 必要 | 高 | **保留** — 低投入（renderer 层读 tier × postponeCost） |
| 3.1#9 长休硬底线（持续骚扰） | 必要 | 中 | **保留** — 没这个 quota 会被滥用；独立 scheduler 投入可控 |
| 3.1#10 被动时间冻结 | 必要 | 高 | **保留** — 现有 pause/resume 挂钩天然存在，投入低 |
| 3.1#11 跨重启持久化 | 必要 | 高 | **保留** — `electron-store` 已在用，投入低 |
| 3.1#12 每日清晨重置 | 必要 | 中 | **保留** — 现有 `morningHour` 字段直接复用 |
| 3.1#13 手动重置 quota（菜单+快捷键） | 必要 | 高 | **保留** — 投入极低，对调试和日常使用关键 |
| 3.1#14 托盘 quota 可视化 | 必要 | 中 | **保留** — 现有 appIcon 已支持多变体，边际投入低 |
| 3.1#15 3 Preset + 高级折叠 | 必要 | 中 | **保留** — 自用场景下高级折叠可复用现有 preferences 分组样式 |
| 3.2#1 i18n 新键（英文） | 必要 | 高 | **保留** — 宪法 §3 只维护英文，成本低 |
| 3.2#2 经典模式零回归 | 必要 | 高 | **保留** — 承诺的核心质量门槛；代码上就是 "`schedulingMode === 'classic'` 走原路径"，保留即可 |
| 3.2#3 经典模式下 quota UI 隐藏 | 必要 | 高 | **保留** — 避免用户困惑，preferences 条件渲染而已 |
| 3.3#1 Quota 历史日记 | 锦上添花 | 低 | **推迟到 v1.22+** |
| 3.3#2 自定义 preset（第 4 个） | 锦上添花 | 低 | **推迟到 v1.22+** |
| 3.3#3 导出 quota 事件日志 CSV | 锦上添花 | 低 | **推迟到 v1.22+** |

### 推迟项

| 功能 | 推迟原因 | 下版本额外成本 | 用户体验断层风险 | 技术债累积风险 |
|------|---------|--------------|----------------|--------------|
| 3.3#1 Quota 历史日记 | Plan 已明确标"锦上添花"；核心 v1.21 无需 | **低**：QuotaManager 已 EventEmit 所有关键事件，未来挂一个 recorder 监听即可；接口已为其预留 | **低**：自用 fork，用户（=本人）能自己感知 quota 波动，无感知断层 | **低**：不推迟会引入一个需要持久化大量事件的子系统，反而增加复杂度 |
| 3.3#2 自定义 preset | 现有 3 preset + advanced 已覆盖绝大多数场景 | **低**：未来加第 4 个 preset 只是 UI 表单一个 input + settings 一个 key | **低**：advanced 折叠已允许任意参数 | **低** |
| 3.3#3 CSV 导出 | 无历史记录就没东西可导 | **低**：依赖 3.3#1；一起做 | **低** | **低** |

**所有推迟项的推迟代价均 < 当前实现成本**，推迟合理。

### 步骤 4 — 未推迟功能全部进入任务分解

见 §5。

---

## 11. 向 Coordinator 上报事项

### 必须等 Product Lead 决策后再开启 T009/T011 的两项

1. **Preset 参数值**（[NEEDS CLARIFICATION]）：
   - 当前已在 defaultSettings 采用 plan 建议值（Default: 25min × 5min；Relaxed: 30min × 5min；Strict: 20min × 5min）
   - 代码不阻塞，但 Product Lead 可能要改具体数值 → 在 T009 preset 逻辑写死前确认即可
2. **长休补小休比例**（`longBreakBonusToMini`）：默认 50，同上不阻塞

### 技术决策（已自主决定，仅通知）

- **不使用**外部状态机库，QuotaManager 手写（5 个状态：normal / frozen / reset / harassing / harassmentFrozen；简单分支足以处理）
- **不引入**新 npm 依赖（复用 `luxon` 做日期，`electron-store` 做持久化）
- Scheduler 新 reference 命名：`startSoftReminder` / `softReminderRepeat` / `longBreakDeadlineTick` / `harassmentRepeat`
- softReminderPosition 字段保留 4 个预设角落；不提供自定义 x/y
- classic 模式下 `__quotaState__` 字段也保留但不更新（切回 quota 时恢复）

### UX 可行性答复（由架构师回复 UX Designer）

**UX-1（托盘 monochrome 兼容）**：
- (a) 现有 tooltip 更新 API：`appIcon.setToolTip(trayMessage)` 由 `main.js:updateToolTip()` 调用，`trayMessage` 由 `StatusMessages.trayMessage` 构建。**可直接在 `main.js:updateToolTip()` 前缀中加 tier 标签**，无需新增 API。
- (b) 新增 settings 键 `tooltipTierPrefix: 'auto' | 'always' | 'never'`，默认 `'auto'`（仅 `useMonochromeTrayIcon === true` 时加前缀，避免彩色图标用户被冗余符号骚扰）。实现归属 T008。

**UX-4（🟠 档 OS toast 点击回调）**：
- **完全可行**。Electron 渲染进程的 `new Notification()` 原生支持 `.onclick`。`app/process-renderer.js:60` 已有现成用法（new-version toast 点击 → 跳转下载页）。
- 实现路径见新增 §3 IF-7：主进程扩 `showQuotaToast({ text, kind, breakType })` → renderer 根据 `kind` 设置 `notification.onclick = () => ipcRenderer.send('quota-toast-take-now', breakType)` → 主进程 `ipcMain.on('quota-toast-take-now', ...)` 路由到 `skipToMicrobreak/skipToBreak`。
- 实现归属 T007（主进程 + IPC）+ T006 扩展 `exposeStretchly()` 中 `onShowQuotaToast`；渲染扩展归 T007 改 `process-renderer.js`（加入 T007 文件所有权）。

### Plan Gap（已发现，有解法）

- Plan §3.1#15 提到"展开高级后暴露全参数"，但未列出全部参数清单 → 架构师在 §3 IF-3 已列全；T009 依此实现
- Plan §6 的 "软提醒小窗走现有 `electron-bridge.mjs` + `contextBridge`" 实际上 break/microbreak 窗用的是 `context-bridge-exposers.js`，不是 `electron-bridge.mjs`（后者是 preferences/contributor 用）→ 架构师已在任务 T006 指定走 `context-bridge-exposers.js` 模式
- 无 blocking gap
