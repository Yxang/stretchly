# 架构宪法（Constitution）

## 项目：Stretchly（自用 fork）
## 创建日期：2026-04-21
## 最后修订：2026-04-21
## 维护者：架构师

> 本文档定义跨版本持久的架构原则。所有版本的 PLANNING.md 设计决策不得违反本文档。
> 修改流程：架构师提出变更 → Coordinator 审批 → 追溯员记录。
> 本项目为 @xinyuany 的自用 fork，不回贡献上游，开源社区流程（CONTRIBUTING.md / 多语言维护 / CHANGELOG）不适用。

---

## 1. 技术栈约束

- Electron 桌面应用（`"main": "app/main.js"`），Node 24.14.0（`.nvmrc` 锁定）
- `package.json` 声明 `"type": "module"` → 所有 `.js` 文件为 ESM（`import`/`export`，不用 `require`）
- 持久化设置用 `electron-store`，新增字段必须在 `app/utils/defaultSettings.js` 提供默认值
- i18n 用 `i18next` + `i18next-fs-backend`，运行时只加载 `app/locales/<lang>.json`
- 测试框架 `vitest`（`test/*.?(c|m)[jt]s`），运行 `npm test`
- 代码风格 StandardJS（无分号、2 空格缩进）；husky pre-commit 跑 `npm run lint`——提交前必须通过

---

## 2. 架构原则

- **主进程 / 渲染进程严格分离**：所有原生能力（tray、globalShortcut、BrowserWindow、electron-store 读写、powerMonitor、文件 IO、DnD 监测、idle 监测）归主进程；渲染进程通过 `contextBridge` 暴露的最小 API 访问主进程（`ipcRenderer.invoke/send`）
- **禁止 `nodeIntegration`**：渲染进程不得直接 require Node 模块；所有新增 IPC 必须在 `app/electron-bridge.mjs` 或 `app/utils/context-bridge-exposers.js` 中显式暴露
- **BreaksPlanner 是唯一的调度状态机**：所有调度决策（下一次休息何时来、当前处于何种阶段、推迟、清空、恢复）集中在 `app/breaksPlanner.js`；`main.js` 只负责把 planner 事件翻译成窗口开关/托盘更新。新增调度模式必须作为 planner 的分支存在，不得在 `main.js` 内另建并行调度
- **Scheduler 是 BreaksPlanner 的唯一定时器**：每个阶段切换都通过 `new Scheduler(func, delay, reference)` 建立，`reference` 字段用于守卫当前阶段（例如 idle/DND/app-exclusion 的 pause 逻辑都 check `scheduler.reference !== 'finishMicrobreak' && ...`）
- **Pause/Resume 来源三条并行链**：`NaturalBreaksManager` / `DndManager` / `AppExclusionsManager`，都通过 planner 上的 `clear/reset` 操作生效。新增的"暂停/冻结"来源必须沿用同样的 pause/resume 事件挂钩模式，不得私自取消 scheduler
- **跨平台三目标**：Windows / macOS / Linux 行为一致，平台差异集中在 `app/platform.js` / `app/utils/utils.js`（`insideFlatpak` / `insideSnap` / `insideWindowsStore` / `insideWindowsPortable`）

---

## 3. 开发范围

- 自用 fork，**不回贡献上游**，不遵循 CONTRIBUTING.md 的"必须先开 issue"/"必须加多语言翻译"/"必须更新 CHANGELOG"要求
- 只维护 **英文 locale**（`app/locales/en.json`）；其他语言文件保留但新增键不补
- 包分发用自用路径（`npm start` / `npm run pack`）；Mac App Store / Flatpak / Snap 特殊适配不在当前范围
- 现有的经典调度模式保留，不得删除——用于 A/B 对比

---

## 4. 跨模块约定

- 时间单位统一用**毫秒**（与现有 `microbreakInterval: 600000` 等一致）
- 日志前缀规范：`System: ...` 表示 OS 级事件（suspend/resume/lock/DnD 变化）；`Stretchly: ...` 表示 app 级状态（开始/暂停/推迟休息）
- 设置 key 使用 camelCase，且必须在 `defaultSettings.js` 有默认值；新增 key 不破坏 v1.20.x 用户升级（无迁移也能跑）
- 窗口 preload 命名约定：`<window>-preload.mjs`；renderer 命名约定：`<window>-renderer.js`；HTML 命名约定：`<window>.html`
- 所有新增持久化字段在 `electron-store` 里必须向前兼容——无此字段时回退默认值

---

## 5. 质量底线

- `npm run lint` 必须通过（StandardJS）
- `npm test` 必须通过（现有 + 新增测试）
- 新增核心模块（含状态机、持久化、调度器）必须配 vitest 单元测试，覆盖 0/100/溢出/边界/复位等
- 渲染进程不得通过 `require` 或 `window.require` 访问 Node 模块；必须经由 contextBridge
- 切换调度模式后，经典模式行为必须与本分支基线一致（零回归）

---

## 6. 安全底线

- 用户自定义 idea 文本必须经 `dompurify` 清洗（已由 `sanitizeIdea.js` 实现）
- 窗口 `webPreferences` 保持 `sandbox: false`（主流使用 preload），但**不得**启用 `nodeIntegration`
- CSP 保持与现有 `preferences.html` 等窗口一致（`default-src 'self'; script-src 'self'`；网络请求仅对白名单域名）；新增窗口遵循同样 CSP

---

## 修订记录

| 日期 | 修订内容 | 提出者 | 审批者 |
|------|---------|--------|--------|
| 2026-04-21 | 初始版本（提炼自 CLAUDE.md + 现有代码） | 架构师 | Coordinator |
