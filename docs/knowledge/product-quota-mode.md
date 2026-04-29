# Quota Mode — Product Positioning and Design Intent

- **Tags**: `quota` `scheduling` `product` `onboarding` `ux`
- **Source**: 版本事件 v1.21 / task #17 user-doc draft
- **Versions-Seen**: v1.21
- **Created**: 2026-04-25
- **Updated**: 2026-04-25
- **Importance**: 4
- **Last Referenced**: —
- **Superseded By**: —
- **Superseded On**: —

## 做了什么

v1.21 引入 Quota Mode 作为 Classic 调度的 opt-in 替代方案。本条目记录产品定位、核心机制摘要，以及与 Classic 的差异，供后续 agent 快速接手时参考。

## 产品定位

**解决的问题**：Classic 模式按"距上次休息的时间"触发，无法记忆"今天已经欠了多少休息"。用户早上连跳三次休息，下午 timer 仍以同样节奏触发，显得无意义。

**Quota Mode 的核心差异**：按"今日剩余配额"驱动，而非固定间隔。配额早上满，工作消耗，休息补充；欠债越多，提醒越强。

**目标用户**：长时间连续使用电脑的用户（开发者、写作者）。不适合会议密集日、Pomodoro 用户、短时使用场景。

## 核心机制摘要

**双配额**：`miniQuota` 和 `longQuota` 各自独立，均 0–100，每早晨重置为 100。

**四档位**（以 mini 为例；thresholds 可在 Advanced 中配置）：

| 档位 | 阈值（默认） | 行为 |
|------|------------|------|
| Green | > 70% | 静默；跌至 70% 触发一次 OS toast（补至 ≥80% 后解锁下次） |
| Yellow | 30–70%（含端点） | 角落软提醒窗，5 分钟间隔 |
| Orange | 10–30%（不含端点） | 角落软提醒窗，2 分钟间隔 |
| Red | ≤ 10% | 全屏休息（同 Classic）；推迟扣费 ×2 |

**软提醒窗口**：非全屏、不抢焦点、屏角弹出；3 按钮（休 / +2min / 忽略）；90 秒自动消失不扣费。Wayland 降级为 OS toast。

**推迟扣费**：推迟 −10%，忽略 −5%，Red 档推迟 ×2。

**长休硬底线**：2 小时未长休 → 持续骚扰模式（间隔按 `base/(k+1)` 递减，默认 base=10 min）。

**冻结场景**：idle / DnD / app exclusion / 电源挂起 → 配额消耗冻结，恢复后继续。

**重置途径**：托盘菜单 "Reset quota" / 自定义快捷键 / CLI `stretchly reset-quota`。

## 关键设计决策（参考文档）

- PLANNING.md §2「关键设计决策」表：懒计算、经典路径零改动、Wayland fallback 等
- ACCEPTANCE.md §Product Lead 产品决策表：preset 数值、长休硬底线 120min、autoClose 不扣费等
- design-tier-sanitize-strategy.md：阈值顺序合法性校验策略（路径 B γ）

## 精炼规则

> Quota Mode 是配额驱动而非时间驱动；文档、UI 文案、FAQ 的首要切入点应是"今天剩余配额"概念，而不是"距上次休息时间"。
