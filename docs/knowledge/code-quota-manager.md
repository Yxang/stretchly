# QuotaManager 架构

- **Tags**：`scheduling` `state-machine` `electron-store` `quota`
- **Source**：版本事件 v1.21
- **Versions-Seen**：v1.21
- **Created**：2026-04-24
- **Updated**：2026-04-24
- **Importance**：4

## 做了什么

v1.21 引入 `app/utils/quotaManager.js` 作为 quota 模式调度的状态机，与经典 `BreaksPlanner` 平行。QuotaManager 本身不启定时器，而是被 BreaksPlanner 的 tick 驱动，持久化通过 `electron-store` 写入 `settings.quota.*` 子树。UI 消费由 tray / soft-reminder / break renderer 通过 IPC 读取 tier + quota。

## 犯了什么错、为什么

AC 15.7 前 `_sanitizeTierThresholds()` 不存在，用户直接在 Preferences 填入非法值（负数、NaN、逆序）不会被任何层拦截，直接进入 `_computeTier()` 比较逻辑，导致 tier 判定错乱（yellow 阈值 > green 阈值时永远不会跨进 yellow）。根因：设置字段校验只在 UI 层用浏览器原生 `min/max` 属性做软拦截，绕过（粘贴、预设导入、老版本 store 迁移）就直通。

## 更好的方式

1. 新增 `electron-store` 字段且带语义约束（非负、单调、枚举）时，**持久化读取点必须配 sanitize**，不能只靠 UI 层校验
2. 调度状态机 `start()` / 持久化读取 / 重置命令三个入口统一调用 sanitize，避免遗漏
3. 测试覆盖：合法 + 逆序 + 非有限 + 0/负数 + cascade 到 0 五类场景都要有

## 精炼规则

> 持久化字段 + 语义约束 = 读取点必须 sanitize；UI 层校验不可信。

## 关键文件

- `app/utils/quotaManager.js` — QuotaManager 实现（sanitize 在 `_sanitizeTierThresholds()` 第 490 行，从 `start()` 第 60 行调用）
- `test/quotaManager.js` — 73 个测试（AC 15.7 sanitize describe 在第 715 行）
- `app/utils/defaultSettings.js` — `quota.tiers.{green,yellow,orange}` 默认 (70,30,10)
