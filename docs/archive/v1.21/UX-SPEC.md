# UX 规格

## 项目：Stretchly Quota 式弹性休息调度
## 版本：v1.21.0（自用 fork）
## 日期：2026-04-21
## 作者：UX Designer

---

## 1. 产品目标

为 Stretchly 引入 Quota 式弹性调度的完整 UI 体验，使用户能在不被打断工作流的前提下感知休息压力、按需推迟或立即休息。核心体验目标：提醒随 quota 衰减逐步升级，余光可见但不抢焦点，用户始终有主动权。

---

## 2. 信息架构

```
Stretchly 应用（quota 模式激活时）
├── 系统托盘
│   ├── 图标（4 档颜色变体：绿/黄/橙/红）
│   ├── Tooltip（两行：Mini: XX% / Long: XX%）
│   └── 右键菜单
│       ├── [现有菜单项]
│       ├── ── 分隔线 ──
│       └── Reset quota（仅 quota 模式可见）
├── 4 档提醒体系
│   ├── 🟢 档（>70%）：OS toast（可忽略）
│   ├── 🟡 档（30-70%）：角落软提醒小窗
│   ├── 🟠 档（10-30%）：角落软提醒小窗 + OS toast 双发
│   └── 🔴 档（<10%）：全屏 break 窗（复用现有）
└── Preferences
    └── Schedule 选项卡
        ├── [现有经典模式参数区]（quota 模式下隐藏 postponesLimit / postponableDurationPercent）
        └── Quota 调度区（仅 quota 模式可见）
            ├── 调度模式开关（经典 / Quota 单选）
            ├── Preset 单选（Relaxed / Default / Strict）
            └── Advanced 折叠区（默认收起）
                ├── x/y 比率参数
                ├── 各档阈值（可选自定义）
                ├── 各档提醒间隔
                ├── 长休硬底线 N（分钟）
                └── 推迟扣费量配置
```

---

## 3. 用户流程

### 流程 A：首次启用 Quota 模式

**入口**：Preferences → Schedule 选项卡

1. 用户打开 Preferences，进入 Schedule 选项卡
2. 看到顶部新增"Scheduling mode"区域，默认"Classic"被选中
3. 用户点选"Quota"
4. Quota 参数区（Preset + Advanced）以渐显动效出现在 Schedule 选项卡内
5. 经典模式下的"Postpone limit"和"Postponable duration"两行同时隐藏（渐隐）
6. 用户选择 Preset 或展开 Advanced 调整参数
7. 用户关闭 Preferences，模式切换下次启动生效（当前会话维持经典模式）

**异常路径**：
- 用户在 Quota 区修改参数后切回 Classic → Quota 参数区完全隐藏，Classic 区完全恢复，已修改的 quota 参数保留在 store 中（不丢失，下次切回 Quota 时原样恢复）

---

### 流程 B：🟢 档提醒（quota > 70%）

**入口**：系统触发时机由 Advanced 中的"Green tier behavior"配置决定（默认为 `on-threshold-cross`）

**三种模式**：

- `silent`：纯托盘颜色变化，无任何通知弹出
- `on-threshold-cross`（默认）：quota 跌破 70% 的瞬间发出一次 OS toast，作为进入 🟡 档的过渡预警；此后 🟢 档内不再重复发送
- `periodic-N`：每 N 分钟（默认 20 min，可在 Advanced 配置）周期性发出 OS toast

**toast 内容**（`on-threshold-cross` 和 `periodic-N` 模式）：
1. OS 通知中心发出一条 toast："Time for a mini break! (Mini: 85%)"
2. Toast 15 秒后自动消失，不需要用户操作
3. 用户可点击 toast → 立即触发小休
4. 用户忽略 toast（不点击、或直接关闭）→ 无 quota 惩罚，仅工作时间继续消耗 quota

---

### 流程 C：🟡/🟠 档提醒 — 角落软提醒小窗

**入口**：系统自动触发（quota 跨越 70% 或 30% 阈值后首次触发提醒间隔）

1. 屏幕右下角淡入一个小窗（300ms ease-in），不抢焦点
2. 小窗显示：quota 进度条（两条）+ "Rest now" / "+2 min" / "Ignore" 三按钮
3. 🟠 档同时发出 OS toast（与小窗内容相同）
4. 小窗在以下情况关闭：
   - 用户点击三个按钮之一
   - 用户按 Esc（等同"Ignore"，扣 quota）
   - quota 档位在小窗存活期间跌至 🔴 → 小窗立即关闭，切换为全屏 break 窗
   - **90 秒无操作 → 自动消失，不扣 quota**（区别于"Ignore"：自动消失视为用户未感知，无惩罚）
5. 小窗右下角显示倒计时文字（如"Closing in 90s"），每秒更新；倒计时归零时触发自动消失

**异常路径**：
- 🟠 档 toast 与小窗同时出现；用户点击 toast → 等同于点击小窗"Rest now"（小窗同时关闭）

---

### 流程 D：🔴 档提醒 — 全屏 break 窗

**入口**：quota < 10% 时触发

1. 全屏 break 窗弹出（复用现有 break/microbreak 窗口，无需改动）
2. `breakStrictMode=false`（默认）：显示"Postpone"按钮，点击后 2× 扣费并关闭窗口
3. `breakStrictMode=true`：隐藏"Postpone"按钮，用户只能完成休息

---

### 流程 E：手动重置 quota

**入口 A**：系统托盘 → 右键菜单 → "Reset quota"

1. 用户右键托盘图标
2. 菜单底部区域显示"Reset quota"（位于现有菜单项下方，用分隔线隔开）
3. 用户点击"Reset quota"→ 立即重置（无二次确认弹窗）
4. 托盘图标立即变为 🟢 色，tooltip 更新为"Mini: 100% / Long: 100%"

**入口 B**：全局快捷键 `resetQuotaShortcut`（默认为空，需用户在 Preferences 中配置）

---

## 4. 交互规格

### 4.1 角落软提醒小窗（新组件 soft-reminder）

**窗口属性**：
- 尺寸：宽 360px，高 108px（固定，不随内容伸缩）
- 位置：屏幕右下角，距右边缘 16px，距底部边缘 16px（macOS 需避开 Dock：若 Dock 在底部，距底 80px；Dock 在侧边时距底 16px）
- `focusable: false`（BrowserWindow 参数，不抢焦点，架构师实现）
- `alwaysOnTop: true`（确保余光可见，不被其他窗口遮挡）
- `frame: false`，`transparent: true`（无原生边框，圆角自行渲染）
- Windows：位置距任务栏上方 16px（任务栏在底部时）

**视觉风格**：
- 背景：半透明磨砂效果（`backdrop-filter: blur(8px)`），底色沿用 `var(--main-bg-color)` 并叠加 80% 不透明度
- 圆角：8px（比现有 break 窗更柔和，对应非全屏定位）
- 阴影：`0 4px 16px rgba(0,0,0,0.2)`
- 字体：复用现有 Noto Sans Regular

**内容布局（从上到下）**：

```
┌─────────────────────────────────────────────────────┐
│ Mini: ████████████░░  85%         16px padding 顶/左/右│
│ Long: ████░░░░░░░░░░  42%                            │
│ ─────────────────────────────────────────────────── │
│  [Rest now]   [+2 min]   [Ignore]   Closing in 87s  │
└─────────────────────────────────────────────────────┘
```

- 行 1-2：quota 进度条区，高约 40px
  - 每条进度条：label（"Mini:"/"Long:"，宽 36px）+ progress 元素（flex-grow）+ 百分比文字（宽 36px）
  - 进度条颜色：绿（>70%）/ 黄（30-70%）/ 橙（10-30%）/ 红（<10%），与当前该 quota 的档位一致
  - 进度条样式复用 commons.css 的 `progress` 元素风格，但高度改为 8px
- 分隔线：1px `var(--hr-bg-color)` 横线
- 行 3：按钮区 + 倒计时区，高约 36px
  - 三按钮左对齐，各约 80px 宽
  - "Rest now"：主操作，视觉上略加强（使用 `push` 类样式中的蓝色背景）
  - "+2 min"：中性操作，默认 button 样式
  - "Ignore"：弱化操作，文字颜色使用低对比度（opacity: 0.6）
  - 倒计时文字右对齐，格式"Closing in Xs"，opacity: 0.4，font-size: 11px；每秒更新；归零触发自动消失（不扣 quota）
  - 用户点击任意按钮或按 Esc 时倒计时停止

**进入/退出动效**：
- 进入：从右下角外侧（translateX(+20px)）以 opacity 0→1 + transform 归位，300ms ease-out
- 退出：opacity 1→0，200ms ease-in，无位移（直接消失）

**键盘交互**：
- Tab 顺序：Rest now → +2 min → Ignore → (循环)
- 默认焦点：无（小窗不抢焦点，Tab 从当前活跃窗口进入小窗需用户主动 Tab 过来）
- Enter：激活当前焦点按钮；若无焦点则等同"Rest now"
- Esc：等同点击"Ignore"（关闭小窗并扣 quota）

**鼠标交互**：
- 点击窗口空白处（非按钮区域）：无操作，不关闭（避免误触）
- 按钮 hover：背景略深化（`filter: brightness(0.9)`）
- 按钮 active（按下）：沿用 commons.css 的 `button:active` 样式（蓝色渐变）

**多显示器**：
- 默认出现在**主显示器**右下角（`screen.getPrimaryDisplay()`）
- 多显示器情况下若用户工作在副屏，接受主屏定位的局限性（本版本不实现活动屏检测）

**Wayland 兜底**：
- 若 Wayland 环境下无法精确定位右下角，回退至**屏幕中央偏下**（y 坐标 = 屏幕高度的 70%，x 居中）
- 不降级为仅 OS toast（小窗仍然显示）

**防抖**：
- "+2 min"按钮点击后立即禁用（`disabled`），500ms 后重新启用，防止连续双击触发两次推迟

---

### 4.2 Preferences — 调度模式区域

**位置**：Schedule 选项卡，顶部第一区块（位于"Mini Breaks"区块之上）

**调度模式开关**：

```
Scheduling mode
○ Classic   ● Quota
```

- 单选（radio），两个选项水平排列，label 文字："Classic" / "Quota"
- 样式与现有 `fullscreen/window` 单选一致（复用 commons.css radio 样式）
- 切换后下方 Quota 参数区立即以渐显（200ms）显示/隐藏（不需要重启即可看到 UI 变化，重启后模式才生效）
- 切换为 Quota 时，同时隐藏经典模式下的"Postpone limit"和"Postponable duration"两行

---

### 4.3 Preferences — Preset 单选区

**显示条件**：仅 Quota 模式激活时可见

**布局**：

```
Preset
○ Relaxed   Work 30 min → rest 5 min
○ Default   Work 25 min → rest 5 min   [默认选中]
○ Strict    Work 20 min → rest 5 min
```

- 三个单选垂直列表，每行：radio + preset 名称（加粗）+ 简短说明（`opacity: 0.7`）
- 选中任一 preset 后，参数区（若 Advanced 已展开）自动更新对应 x/y 值
- 用户在 Advanced 区修改参数后，三个 preset 均取消选中状态（无选中高亮）；不新增"Custom"选项
- 切换 preset 时，若 Advanced 已展开，参数值可见地更新（视觉联动）

---

### 4.4 Preferences — Advanced 折叠区

**显示条件**：仅 Quota 模式激活时可见

**折叠行为**：
- 默认收起，仅显示"Advanced ▸"触发行
- 点击后展开，箭头变为"Advanced ▾"；再次点击收起
- 展开/收起：height 过渡动效，200ms ease（`max-height` 从 0 到 auto 的过渡）

**展开后的参数分组（从上到下）**：

```
── Work/rest ratio ──────────────────────
  Work cycle (x)   [slider]  25 min
  Rest duration (y) [slider]  5 min

── Alert thresholds ──────────────────────
  Yellow alert below  [slider]  70 %
  Orange alert below  [slider]  30 %
  Red alert below     [slider]  10 %

── Alert behavior ────────────────────────
  Green tier behavior  [下拉/单选]
    ● Silent (tray color only)
    ○ On threshold cross (default)   ← 默认
    ○ Periodic every [slider] 20 min
  Yellow interval  [slider]   5 min  ← 默认 5 min
  Orange interval  [slider]   2 min  ← 默认 2 min

── Long break deadline ───────────────────
  Force long break after  [slider]  120 min

── Postpone penalty ──────────────────────
  Postpone deduction    [slider]   5 %
  (Red tier = 2× deduction, automatic)
```

- slider 样式复用现有 `input[type="range"]`，宽 200px
- 每组以组标题（14px，`opacity: 0.6`）+ 水平分隔线区隔
- "Red tier = 2× deduction"为只读说明文字，不可配置（系统固定行为）

**阈值顺序约束**（强制 Yellow > Orange > Red，后端修正 + UX 内联提示）：
- UX 层 slider 本身不阻止反序输入，用户可自由拖动
- 当检测到反序（如 Orange ≥ Yellow 或 Red ≥ Orange）时，在该 slider 下方显示内联警告文字（红色，font-size: 11px），例如：
  - "Yellow must be greater than Orange"
  - "Orange must be greater than Red"
- 内联警告文字在顺序恢复合法后立即消失
- 保存时由架构师在 QuotaManager 侧强制修正反序值（UX 层不拦截保存操作）

---

### 4.5 托盘 Quota 可视化

**图标变体**：

| 档位 | 颜色含义 | 图标文件命名建议（由架构师实现） |
|------|---------|-------------------------------|
| 🟢 Green | mini quota > 70% | `trayQuotaGreen*.png` |
| 🟡 Yellow | mini quota 30-70% | `trayQuotaYellow*.png` |
| 🟠 Orange | mini quota 10-30% | `trayQuotaOrange*.png` |
| 🔴 Red | mini quota < 10% | `trayQuotaRed*.png` |

- 档位颜色以 miniBreakQuota 为主判据（mini quota 更频繁，更能反映即时状态）
- longBreakQuota 仅通过 tooltip 文字体现，不另设单独图标维度
- macOS monochrome 模式：图标不使用颜色，改在 tooltip 文字中用 [G]/[Y]/[O]/[R] 前缀标注（如"[Y] Mini: 65% / Long: 80%"）
- 经典模式：不使用 quota 图标变体，恢复原有 `trayIconStyle` 逻辑

**Tooltip 格式**：

```
Mini: 65%
Long: 80%
```

- 两行，quota 模式下追加在现有 tooltip 内容之后（若现有 tooltip 有内容，先换行再追加）
- 经典模式：不显示这两行

---

### 4.6 托盘菜单 — Reset quota

**位置**：现有托盘菜单末尾，紧接 separator 之后

**显示条件**：仅 quota 模式

**菜单项文字**："Reset quota"

**点击行为**：
- 无二次确认
- 立即将 miniBreakQuota 和 longBreakQuota 重置为 100
- 托盘图标和 tooltip 立即更新

---

## 5. 边界情况

| 场景 | 触发条件 | 处理方式 | 用户反馈 |
|------|---------|---------|---------|
| 档位在小窗存活期间跌至 🔴 | quota 从 🟡/🟠 跌破 10% | 立即关闭小窗，显示全屏 break 窗 | 无额外提示，过渡自然 |
| quota 从 🔴 回升至 🟡（休息完成） | 全屏窗关闭后 quota 上升 | 下次触发时使用小窗而非全屏窗 | 无额外提示 |
| Wayland 精确定位失败 | Linux Wayland 环境 | 小窗居中偏下（屏幕高度 70% 处） | 无提示，用户自行感知 |
| 多显示器，用户在副屏工作 | 活动窗口在非主屏 | 小窗出现在主屏右下角 | 本版本接受此局限 |
| 小窗存活期间"+2 min"连续双击 | 快速双击 | 第一次点击后按钮 disabled 500ms | 按钮无响应（视觉变灰），500ms 后恢复 |
| quota 模式切回经典模式 | 用户在 Preferences 切换 | Quota 参数区隐藏；postponesLimit 等恢复可见 | 即时 UI 更新，模式变更下次启动生效 |
| quota 已为 100 时触发手动重置 | 点击"Reset quota" | 执行重置（值不变），无错误 | 无提示（视觉无变化，符合预期） |
| 经典模式下托盘右键菜单 | 当前为 classic 模式 | "Reset quota"菜单项不存在 | 无 |
| Strict mode 下 🔴 档弹窗 | `breakStrictMode=true` | 全屏窗口隐藏"Postpone"按钮 | 用户只能关闭（休息完成）或等待倒计时 |

---

## 6. 一致性规范

- **按钮样式**：三按钮复用 commons.css `button` 基础样式；主操作"Rest now"使用 `push` 类（蓝色激活态）；次要操作"+2 min"使用默认样式；弱操作"Ignore"降低 opacity 但不使用 disabled 样式
- **进度条颜色**：quota 进度条颜色与托盘图标档位颜色语义一致（绿/黄/橙/红），形成全局一致的颜色系统
- **动效时长**：进入 300ms / 退出 200ms / 折叠展开 200ms，统一 ease 曲线，不使用弹簧动效
- **Radio / Checkbox**：调度模式开关和 Preset 单选均复用 commons.css 的 `input[type="radio"]` 自定义样式
- **分隔线**：折叠区内分组分隔线与 preferences.html 现有 `<hr>` 一致
- **隐藏策略**：条件 UI（quota 参数区、菜单项）通过 JS 动态添加/删除 DOM 节点实现，非仅 CSS `display:none`（符合 AC 18.1 要求）
- **Tooltip 追加**：quota 两行 tooltip 追加在现有 tooltip 内容之后，不替换现有内容
- **无确认弹窗**：Reset quota 操作不需要二次确认（ACCEPTANCE.md §13 明确说明）

---

## 7. 待确认事项

| # | 问题 | 影响范围 | 状态 |
|---|------|---------|------|
| 1 | macOS monochrome 模式下托盘图标无法显示颜色；建议在 tooltip 前缀中用 [G]/[Y]/[O]/[R] 标注 | 托盘图标 / tooltip | **已确认（架构师）**：`main.js:updateToolTip()` 前缀加 `[G]/[Y]/[O]/[R]`；新增 settings key `tooltipTierPrefix: 'auto'|'always'|'never'`，默认 `'auto'`（仅 monochrome template icon 模式下生效）。归属 T008 |
| 2 | 小窗自动消失行为 | 软提醒小窗 | **已决策（PL）**：90 秒无操作自动消失，不扣 quota；已更新 §3 流程 C 和 §4.1 |
| 3 | Advanced 阈值 slider 是否强制 Yellow > Orange > Red | Advanced 折叠区 | **已决策（PL）**：UX 层仅显示内联警告文字（不 slider 联动），由架构师在 QuotaManager 侧保存时修正；已更新 §4.4 |
| 4 | 🟠 档 OS toast 点击回调可行性；建议点击 toast 等同"Rest now" | 🟠 档交互 | **已确认（架构师）**：完全可行，复用 `process-renderer.js:60` 的 `Notification.onclick` pattern；toast 文字为"Break reminder (Mini: XX%)"，点击触发 Rest now 等同操作。归属 T007（主进程 IPC）+ T006（preload 扩 `onShowQuotaToast`），接口契约见 PLANNING.md §3 IF-7 |

---

## 8. 变更记录

| 版本 | 日期 | 变更内容 | 变更原因 |
|------|------|---------|---------|
| 1.0 | 2026-04-21 | 初始版本，覆盖 5 大 UX 产出物 | 启动 UX 阶段 |
| 1.1 | 2026-04-21 | §3 流程 B：🟢 档改为三模式（silent/on-threshold-cross/periodic-N）；§4.4 Advanced："Green interval"改为"Green tier behavior"枚举 + 条件 N slider，Yellow 默认 5min，Orange 默认 2min；§7 #UX-3 补充 UX 层备选方案 | 用户裁定歧义（on-threshold-cross 为默认 / Yellow 5min / Orange 2min） |
| 1.2 | 2026-04-21 | §3 流程 C：补充 90 秒自动消失关闭条件（不扣 quota）；§4.1 小窗布局：新增倒计时文字区；§4.4 阈值区：补充联动约束规则（Yellow > Orange > Red，联动降低 + 短暂高亮提示）；§7 #UX-2/#UX-3 标注已决策 | Product Lead 审批通过，#UX-2/#UX-3 产品决策落地 |
| 1.3 | 2026-04-21 | §7 #UX-1/#UX-4 标注已确认并补入架构决策结果 | 架构师回复技术可行性确认 |
| 1.4 | 2026-04-21 | §4.4 阈值约束：从"slider 联动"改为"内联警告文字 + 后端修正"（不阻止 slider 输入）；§7 #UX-3 更新状态描述 | Product Lead 确认 #UX-3 采纳备选方案（架构师侧修正，UX 层仅提示） |
