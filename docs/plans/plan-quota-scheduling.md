# Stretchly — Quota 式弹性休息调度

> **目标版本**：自用 fork（不回贡献上游；不遵循 CONTRIBUTING.md 的开源流程）
> **计划日期**：2026-04-21
> **前置版本**：v1.20.0
> **背景**：现有固定节奏调度（每 10 分钟小休、每 3 次替换为长休）对专注工作打扰感强；希望引入 quota 式弹性调度——允许推迟，但推迟要付代价；quota 越低，提醒强度越高。作为新调度模式与经典模式并存，可 opt-in 切换（留给自己调试与日常切换用）。

---

## 1. 目标

把 stretchly 的调度从"到点必休"升级为"quota 弹性"：小休 / 长休各有独立 0-100 的 quota，工作持续消耗、休息补充、"忽略 / 推迟"扣减；quota 越低提醒强度越高，共 4 档提醒（托盘 → OS toast → 角落软小窗 → 全屏）。另设独立的"长休硬底线"机制——超过 N 小时未长休时进入"持续骚扰"模式，避免极端滥用弹性。整个 quota 模式为可选（opt-in），经典模式继续存在且行为零变化。

---

## 2. 现状分析

### 技术栈与工程约束
- Electron 桌面应用；Node 24.14.0（`.nvmrc`）；`"type": "module"` → ESM
- StandardJS（无分号、2 空格；husky pre-commit 跑 `npm run lint`）
- 设置持久化：`electron-store`
- i18n：`i18next` + `i18next-fs-backend` + `app/locales/*.json`
- 测试：`vitest`（`test/*.?(c|m)[jt]s`）
- 渲染窗口用 `contextBridge` 暴露最小 API（无 `nodeIntegration`）

### 与需求相关的现有模块
- `app/breaksPlanner.js` — `BreaksPlanner extends EventEmitter`，核心状态机；当前按 `breakNumber % (breakInterval+1)` 决定每 N 次小休替换为长休
- `app/utils/scheduler.js` — `setTimeout` 的轻封装，带 `reference` 字段标识当前 pending 阶段
- `app/utils/defaultSettings.js` — 所有用户可配置项的单一源
- `app/main.js` — 监听 planner 事件、创建/关闭 break / microbreak / welcome 等 BrowserWindow；`showNotification(text)` 通过隐藏的 `processWin` 调用 renderer 的 `new Notification()`，输出 OS 原生 toast
- `app/utils/naturalBreaksManager.js` — `node-desktop-idle-v2` idle 检测，触发 `clearBreakScheduler` / `naturalBreakFinished`
- `app/utils/dndManager.js` — OS DnD（Focus Assist / macOS notification state / Linux D-Bus）
- `app/utils/appExclusionsManager.js` — 根据 `ps-list` 进程名暂停（`pause`）或强制恢复（`resume`）
- `app/utils/appIcon.js` — 托盘图标与菜单（已支持 monochrome / inverted 变体）
- `app/utils/commands.js` — CLI 式命令，可绑定全局快捷键

### 现有打扰强度（3 档）
1. **托盘图标 + tooltip**（被动）
2. **OS 系统通知**（`processWin` + `new Notification()`；`silentNotifications` 可静音）
3. **全屏 break 窗口**（`BrowserWindow`，可配 fullscreen；已有 postpone 按钮）

### 当前已有的"弹性"机制（新 quota 模式下将被替代或重新映射）
- `microbreakPostpone` / `breakPostpone` + `PostponeTime` + `PostponesLimit`（默认推迟 1 次）
- `PostponableDurationPercent`（必须已休息到 30% 才能推迟）
- `microbreakStrictMode` / `breakStrictMode`（禁用推迟，反向的"硬"）
- `naturalBreaks` 自动暂停
- `morningHour`（早晨阈值；quota 模式复用此为"每日重置"边界）

---

## 3. 功能需求

### 3.1 核心功能（必须）

| # | 功能 | 描述 | 涉及模块 |
|---|------|------|---------|
| 1 | 调度模式开关 | preferences 新增"调度模式"：**经典（默认）/ Quota**；全用户升级后默认经典，quota 为 opt-in | `preferences.html`, `defaultSettings.js`, `BreaksPlanner` |
| 2 | 独立双 quota 状态机 | `miniBreakQuota`、`longBreakQuota` 各 0-100，独立阈值、独立提醒通道、独立补给规则 | 新增 `app/utils/quotaManager.js`（建议） |
| 3 | 工作消耗 quota | 工作时间按公式持续扣 quota；公式基于 x:y 比率（每 x 分钟工作对应 y 分钟休息来恢复满 quota） | `QuotaManager` |
| 4 | 休息补充 quota | 小休/长休正常进行按时长线性补对应 quota；长休额外补少量小休 quota（**[待确认] 建议补 ~50%**） | `QuotaManager` |
| 5 | 推迟扣 quota | **所有"忽略"行为**都扣：点"推迟"按钮 / 关软小窗 / 不点 toast / 到建议时刻未休继续工作。扣减量在正常工作消耗之上叠加 | `QuotaManager`, `BreaksPlanner` |
| 6 | 4 档提醒升级 | 🟢 >70% 仅托盘变色 + 可忽略 OS toast；🟡 30-70% 角落软提醒小窗；🟠 10-30% 软小窗 + OS toast 双发、间隔更短；🔴 <10% 全屏 break 窗 | 新增 `soft-reminder.html` + 复用现有 toast/break 窗 |
| 7 | 角落软提醒小窗（新 UI） | 非全屏、不抢焦点、屏幕角落；显示当前 quota 条 + 三按钮：「现在休」「+2 分」「忽略」；键盘可操作（Tab/Enter/Esc） | 新增 `app/soft-reminder.html`, `soft-reminder-renderer.js`, `soft-reminder-preload.mjs` |
| 8 | 红档推迟 2× 扣费 | 🔴 档全屏窗仍允许推迟，但单次推迟扣 2× quota；保留 `breakStrictMode` / `microbreakStrictMode` 作为"🔴 档禁推迟"特例 | `QuotaManager`, `break-renderer.js`, `microbreak-renderer.js` |
| 9 | 长休硬底线（持续骚扰模式） | 独立触发器：距上次长休 ≥ N 小时 → 进入"持续骚扰"（与 quota 档位独立）。拒绝 k 次后下次提醒间隔按 `interval = base / (k+1)` 之类递减，最终几乎连续弹窗。**不强制全屏**，靠频率逼用户休息 | `BreaksPlanner`, `QuotaManager`, `Scheduler`（新 reference：`longBreakDeadlineTick`） |
| 10 | 被动时间语义（quota 冻结） | `naturalBreaks` idle / DnD / AppExclusion pause 期间：quota 既不扣也不补（冻结），等用户回来继续 | `BreaksPlanner` 现有 pause/resume 事件挂钩 |
| 11 | Quota 跨重启持久化 | 关机/重启后 quota 保留；用 `electron-store` 存最后值 + 退出时间戳 | `electron-store` schema |
| 12 | 每日清晨重置为满 | 以 `morningHour`（现有参数，默认 6 点）为日界；跨该时刻后首次启动或首次工作，quota 重置为 100 | `BreaksPlanner`, `QuotaManager` |
| 13 | 手动重置 quota | 托盘菜单加"重置 quota"；新增可配全局快捷键 `resetQuotaShortcut` | `appIcon.js`, `commands.js`, `defaultSettings.js` |
| 14 | 托盘 quota 可视化 | 托盘图标按 🟢🟡🟠🔴 四档变色（或加角标）；tooltip 增加两行：`Mini: 85%` / `Long: 60%` | `appIcon.js` |
| 15 | 3 个 Preset + 高级折叠 | preferences 的 quota 区默认仅展示「宽松 / 默认 / 严格」三个 preset 单选；展开「高级」后暴露全参数（x、y、各档阈值、提醒间隔、长休硬底线 N 等） | `preferences.html` |

### 3.2 重要功能（应该）

| # | 功能 | 描述 | 涉及模块 |
|---|------|------|---------|
| 1 | i18n 新键（仅英文） | 所有新 UI 文案进 `app/locales/en.json`；自用无需维护其他语言 | `app/locales/en.json` |
| 2 | 经典模式零回归 | 切回经典时所有现有行为（含 strictMode、postponesLimit、postponableDurationPercent 等）完全不变，方便 A/B 对比自己用得惯 | `BreaksPlanner`, 回归测试 |
| 3 | 经典模式下 quota 相关 UI 隐藏 | preferences 按当前调度模式条件渲染对应区块 | `preferences.html` |

### 3.3 锦上添花（可选）

| # | 功能 | 描述 | 涉及模块 |
|---|------|------|---------|
| 1 | Quota 历史日记 | 今日 quota 曲线、休息/推迟次数统计 | 新增统计窗口 |
| 2 | 自定义 preset | 用户把自己的参数组合保存为第 4 个 preset | `preferences.html` |
| 3 | 导出 quota 事件日志（CSV） | 调参 / 研究用途 | `commands.js` |

---

## 4. 非功能性需求

- **性能**：quota 衰减采用事件驱动 + 懒计算，不开高频计时器（≤ 1 Hz）；被动时间完全无 CPU 活动
- **跨平台**：Windows / macOS / Linux 行为一致；**角落软提醒小窗在多显示器、fractional scaling、Wayland 下定位正确**（Wayland 有已知 Electron 定位限制，必要时回退到 OS toast）
- **兼容性**：`electron-store` schema 向前兼容——所有新字段有默认值；v1.20.0 用户升级后不需任何迁移即可正常运行
- **可访问性**：软提醒小窗支持键盘（Tab/Enter/Esc）；色盲不依赖仅靠颜色区分档位，托盘 tooltip 明文标注百分比
- **测试覆盖**：新 `QuotaManager` 单元测试覆盖边界（0 / 100 / 冻结 / 重置 / 硬底线触发与退出）

---

## 5. 范围边界

**本版本包含**：
- Quota 模式核心状态机（双 quota、工作消耗、休息补充、推迟扣减、档位判定）
- 4 档提醒升级 + 新增角落软提醒小窗
- 长休硬底线 + 持续骚扰模式
- 跨重启 / 跨日 quota 生命周期
- preferences 调度模式开关 + 3 preset + 高级折叠
- 托盘图标 / tooltip 的 quota 可视化
- 手动重置 quota（菜单 + 快捷键）
- 必要的 i18n（英文完整）
- 经典模式的零回归保证

**本版本不包含**：
- Quota 历史统计视图（→ 锦上添花 / 下一版本）
- 多设备同步 quota（stretchly 本身无云同步）
- 对 Mac App Store / Flatpak / Snap 的额外沙盒适配（保持现有包发布流程）
- 向老用户强制推送 quota 模式
- 移除现有的经典调度代码（经典模式继续存在）

---

## 6. 技术上下文

### 现有代码可复用部分
- `BreaksPlanner` 事件体系（`startMicrobreak` / `startBreak` / `finishMicrobreak` / `updateToolTip` / `resumeBreaks` 等）可直接扩展
- `Scheduler` 的 `reference` 机制可增加新 reference（如 `startSoftReminder` / `longBreakDeadlineTick` / `softReminderRepeat`）
- `processWin.showNotification()` 可直接复用为 🟢 / 🟠 档的 OS toast 源
- 现有 `break.html` / `microbreak.html` 窗口代码直接作为 🔴 档 UI，无需重写
- `NaturalBreaksManager` / `DndManager` / `AppExclusionsManager` 的 pause/resume 事件是 quota 冻结的天然挂点
- `appIcon.js` 已支持多种图标变体，添加 quota 档位变体为同类扩展

### 技术约束
- 必须保持 ESM（`"type": "module"`）
- StandardJS 风格（无分号、2 空格；husky 会拒绝违规 commit）— 可考虑放宽或保留，自用场景下按偏好决定
- 每个新模块需对应 `test/` 下的 vitest 单元测试
- Linux 上跑 DndManager 测试需 `DBUS_SESSION_BUS_ADDRESS`
- 不走开源贡献流程：无需开 GitHub issue、无需遵守 CONTRIBUTING.md、无需考虑向上游回贡献的兼容性

### 架构建议（供架构师参考，非强制）
- 新增 `app/utils/quotaManager.js` 作为"工作消耗 / 休息补充 / 推迟扣减 / 档位判定 / 持久化 / 每日重置 / 硬底线"的集中处
- `BreaksPlanner` 增加 `schedulingMode` 分支：`classic` / `quota`；两套调度路径并行存在但互斥激活
- 软提醒小窗走现有 `electron-bridge.mjs` + `contextBridge` 模式
- 长休硬底线用独立的 `Scheduler`（reference = `longBreakDeadline`）；触发后切到"持续骚扰"子状态机

---

## 7. 已知风险与开放问题

| # | 问题/风险 | 状态 | 影响 | 备注 |
|---|----------|------|------|------|
| 1 | 3 个 preset 的 x:y 具体数值 | 待确认 | 中 | 建议：Relaxed `30:5`、Default `25:5`、Strict `20:5`；由 Product Lead 基于现有默认（`microbreakInterval=600s`, `microbreakDuration=20s`）校准 |
| 2 | quota 满额的基准语义 | 待确认 | 中 | 建议：100% = 1 个完整工作周期 x 分钟后耗至 0%；线性衰减 |
| 3 | 长休是否补少量小休 quota | 待确认 | 低 | 建议：长休补 50% 的小休 quota（长休后不应再被小休烦） |
| 4 | 长休硬底线 N 的默认 | 待确认 | 中 | 建议：120 分钟；由 Product Lead 确认 |
| 5 | "持续骚扰"的终止与退出 | 待确认 | 中 | 建议：长休完成 → 退出；关机/DnD/自然休息 → 冻结暂停，恢复后继续累计 |
| 6 | 软提醒小窗在 Linux/Wayland 定位 | 推断 | 中 | Electron BrowserWindow 在 Wayland 历史上有定位限制；必要时回退到 OS toast 或放中央 |
| 7 | strictMode 语义收敛 | 推断 | 低 | 经典模式下保持原意；quota 模式下 strictMode=on 意味着"🔴 档禁止推迟" |
| 8 | postponesLimit / postponableDurationPercent 在 quota 模式下的命运 | 待确认 | 低 | quota 模式下不再使用；preferences 条件隐藏；电子 store 字段保留以便切回经典 |
| 9 | i18n 新增键数量 | 推断 | 低 | 估计 15-25 条；首发英文完整，其他语言交社区 |
| 10 | 现有测试是否会因 `BreaksPlanner` 改造而回归 | 推断 | 中 | `test/breaksPlanner*` 需同步更新；并新增 quota 专门用例 |
| 11 | 升级后的本地自编译/打包流程 | 推断 | 低 | 自用通常 `npm run pack` / `npm start` 即可；若要签名安装包需自己配置 |

---

## 8. 交付物

| # | 交付物 | 形式 | 说明 |
|---|--------|------|------|
| 1 | Quota 模式实现 | 合并到 trunk 的变更 | 含 `QuotaManager`、BreaksPlanner 改造、软提醒小窗、托盘可视化、持久化、每日重置、硬底线 |
| 2 | preferences UI 更新 | 同上 | 调度模式开关 + 3 preset 单选 + 高级折叠 + 条件隐藏 |
| 3 | 单元测试 | `test/quotaManager.js` + 更新现有 `test/breaksPlanner*` | 覆盖 quota 边界、档位切换、硬底线触发与退出、冻结、每日重置 |
| 4 | i18n 新键（英文） | `app/locales/en.json` | 自用场景下只维护英文即可 |
| 5 | 本地可运行的 build | `npm start` 或 `npm run pack` | 最终能在自己机器上跑起来；打包安装包视需要而定 |

---

## 9. 交付期望

- 在 quota 模式下，我能"从容地推迟"休息而不是被硬打断；但长期工作会感受到逐步升高的提醒压力，最终仍会回到休息
- 小休 / 长休各自的 quota 状态直观可见（托盘颜色 + tooltip），不打开 preferences 也能感知
- 🟡 档的角落软提醒小窗在专注写代码时是"余光瞥见可忽略"的，不破坏心流；但积累到 🟠/🔴 档时会越来越难忽略，直至逼我休息
- 切回经典模式后，整个应用行为与 v1.20.0 完全一致，零回归（便于自己在两种模式间对比哪种更顺手）
- 参数可配：简单用户选 3 个 preset 之一即可；专家用户展开"高级"后能微调每项
- 连续工作超过长休硬底线 N 小时（建议 2 小时）后，无论 quota 多少，系统都会越来越频繁地弹提醒，最终几乎不让我继续工作
- 跨重启 / 跨日 quota 状态符合直觉：早晨开始时满 quota；白天中途关机重启不重置；跨过清晨边界后重置为满
- 自然离开电脑（idle / 锁屏 / DnD / 特定 app 运行）期间 quota 冻结，不会"被动欠账"
