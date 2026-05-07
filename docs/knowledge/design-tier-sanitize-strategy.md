# Tier 阈值 Sanitize 策略（路径 B γ）

- **Tags**：`quota` `sanitize` `user-input` `fallback-strategy`
- **Source**：版本事件 v1.21 AC 15.7 hotfix
- **Versions-Seen**：v1.21
- **Created**：2026-04-24
- **Updated**：2026-04-24
- **Importance**：5

## 做了什么

AC 15.7 设计时，PL 给出 3 条候选（β / γ / hybrid），最终 Coordinator 通过 X/Y 输出-only 锁定选择路径 B γ：

- **策略 Y（γ）**：任一原始值非有限 or ≤0 → 整组 reset 到默认 (70,30,10)
- **策略 X（cascade clamp）**：原始值全有效但违反单调（yellow<green, orange<yellow）→ 级联夹紧（yellow = min(yellow, green-1), orange = min(orange, yellow-1)）；任一值被夹到 0 或更低 → 整组 reset

实现在 `quotaManager.js:490` 的 `_sanitizeTierThresholds()`。

## 犯了什么错、为什么

规格评审阶段走了弯路，原因：
1. PL message 2 的"4 步算法字面执行"（算出 orange=29 β）与 Final Call（γ 规则：orange=10）存在数值矛盾，架构师当时只核对了 Final Call 文字没核对算法字面值
2. tech-qa F1 场景（NaN,-1,70）测试预期在 β / γ / hybrid 三种语义下是不同结果（β=29 / γ=10 / hybrid=混合），规格不锁定时测试反复改写，浪费 3+ 轮

## 更好的方式

1. **规格多轮变更后，架构师必须做一次"字面执行 vs 结论文字"核对**，发现矛盾立刻请 Coordinator 做 X/Y 锁定，不能假设 Final Call 就是正确
2. **sanitize 策略拆分为独立函数**（当前已是 `_sanitizeTierThresholds` 单函数），下个版本如果需要第二种语义（如 per-field 的"值由用户选择是否 reset"），应重构为 `_fallbackToDefault()` + `_cascadeClamp()` 两阶段
3. **all-or-nothing 原则**：γ 策略的核心是"一票否决全组"，避免用户看到被"修补"的半合法值产生困惑（如 (NaN,30,10) → (70,30,10) 而非 (70,30,10) 其中 30 保留但 NaN 修 70）

## 精炼规则

> 规格多版本冲突时，Coordinator 做 X/Y 输出-only 锁定；架构师核对"字面执行 vs 结论"避免漏网。

## 关键文件

- `app/utils/quotaManager.js:490-550` — 实现
- `test/quotaManager.js:715-920` — 覆盖 6 类场景：F1 非有限、F2 全 ≤0、F3 正常逆序、F4 边界等号、F5 双逆序、F6 有效单调不触发
- `docs/team/ACCEPTANCE.md` AC 15.7 — 验收定义
