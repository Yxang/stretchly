# Phase 3-5 关键技术决策（4 项）

- **编号**：027
- **时间**：2026-05-06 20:02
- **阶段**：决策冻结
- **涉及角色**：架构师、Product Lead

## 发生了什么

在 Phase 3 评估中确定的 4 项关键技术决策，由架构师和 Product Lead 联合批准：

### 决策 1：Bug 4（break-window 关闭行为）— 选项 3

**决策内容**：沿用 v1.21 行为，break window 不强制关闭用户。
**理由**：与产品设计一致，保留用户自主权。用户可手动关闭或等待 break 完成。
**影响范围**：break-renderer.js、BreaksPlanner 状态管理。

### 决策 2：工具链标准化 — 三轨方案

**决策内容**：screencapture（native macOS）+ osascript（脚本化）+ capturePage（Electron 原生）三轨并行。
**理由**：覆盖多种 QA 场景；否决 playwright-electron（性能开销、依赖复杂度）。
**影响范围**：Tech-QA 截图采集、dev-log/screenshots/ 归档。

### 决策 3：Bug 2（i18n 硬编码）— 范围收敛

**决策内容**：i18n 子项移出修复范围。grep 验证结果：0 处硬编码英文，issue 由 CSS 排版问题引起。
**理由**：范围聚焦，避免过度修复。修复内容收敛为 CSS 排版调整。
**影响范围**：soft-reminder-renderer.js CSS / preferences-renderer.js 布局。

### 决策 4：zh-CN L4 验收门槛 — 严格模式

**决策内容**：L4 验收标准（zh-CN 国际化完整性）不通过则直接打回，不走 known-issue 豁免路径。
**理由**：zh-CN 是一级支持语言，质量标准不可降级。
**影响范围**：Tech-QA L4 验收评分、hotfix 决策链路。

## 后续影响

决策 1-2 直接约束 T-201/T-204/T-202 的实现边界。
决策 3 影响 T-203 的范围（原计划的 i18n 工作量 -30%）。
决策 4 影响 Phase 6（产品 QA）的合格线评判标准。

## Pattern Note

🔁 三轨工具方案：与 v1.21 冻结流程中工具选型争议同源，本版本通过 phase 3 早期冻结规避了返工。
