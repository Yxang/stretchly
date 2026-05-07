---
name: i18n AC 精度：参数名对齐 + 误诊识别
description: v1.22 产品验收经验：i18next 占位符参数名与模板 key 必须强制对齐检查；Bug 2 i18n 误诊的识别流程
type: project
---

# i18n AC 精度：参数名对齐 + Bug 误诊识别

- **Tags**: `i18n` `acceptance-criteria` `bug-diagnosis` `product`
- **Source**: 版本事件 v1.22
- **Versions-Seen**: v1.22
- **Created**: 2026-05-07
- **Updated**: 2026-05-07
- **Importance**: 4
- **Last Referenced**: —
- **Superseded By**: —
- **Superseded On**: —

## 做了什么

v1.22 修复 5 个 quota 模式 bug。PL 在写验收标准过程中犯了两类可量化的精度错误：
1. Bug 5 早期 AC 未检查调用方参数名是否与 i18next 模板 key 匹配（`{ seconds }` vs `{{count}}`）
2. Bug 2 AC 初版误诊为"i18n + CSS 双重问题"，错把 Bug 3（zh-CN 缺译 fallback）当成 Bug 2 的一部分

## 犯了什么错、为什么

### 错误 1：i18next 占位符参数名未验证

`app/soft-reminder-renderer.js` 调用 `t('quota.softReminder.closingIn', { seconds })`，
而 `en.json` 模板为 `"Closing in {{count}}s"`，参数 key 不一致（`seconds` ≠ `count`）。

早期 AC 只写"倒计时显示实际秒数"，未指定需验证调用方传的参数名与模板对齐。导致这条 AC 本质上是"结果验证"而非"根因验证"——即使结果侥幸正确，根因仍是错的。

**根源**：PL 在写 AC 时仅从用户可见症状（显示 `{{count}}s`）出发，未追溯到代码调用层的参数名约定。

### 错误 2：Bug 2 i18n 误诊

plan §2 描述 Bug 2 时提到"部分 Advanced 标签显示英文"，PL 将其归入 Bug 2 验收范围，写了 AC 4.2/4.3（i18n completeness check）。

架构师 grep 确认 `preferences.html` advanced 区全部已用 `data-i18next`，无硬编码英文。用户看到英文是因为 Bug 3（zh-CN 缺 quota.* 全命名空间）导致 i18next fallback 到 en，症状在 Bug 2 区域出现，根因在 Bug 3。

**根源**：PL 根据 plan 描述的症状定义 AC，未做 grep 确认"是否真的有硬编码英文"，就预设了 i18n 补全工作存在。

## 更好的方式

### 对齐检查清单（i18n 类 bug AC 必做）

编写 i18n 相关 AC 时，在定稿前强制执行：

1. **模板 key 确认**：在 `en.json` 中定位该 key，记录占位符名称（`{{count}}` / `{{percent}}` 等）
2. **调用方确认**：grep 找到所有调用方，确认传入的参数 key 名称与模板一致
3. **AC 同时覆盖两层**：L1 文件审查（模板 key）+ L1 调用方参数名（不能只写 L3 结果截图）

### 误诊识别流程（症状归因）

当 plan 描述"区域 X 出现问题 Y"时：

1. **先 grep 确认**：Y 是否真的存在于 X 区域（排除 fallback / 间接症状）
2. **问"这条症状最近的根因在哪"**：是 X 本身，还是另一个 bug 的 side-effect？
3. **如果是 side-effect**：将 AC 移到根因 bug，在 X 的 AC 中写"排除该症状，症状归因于 Bug N"
4. **写 scope exclusion**：在 ACCEPTANCE.md 对应功能下明确标注"本功能不包含 Y（已由功能 N 覆盖）"

## 精炼规则

> i18n 类 bug 的 AC 必须同时覆盖模板 key 名称和调用方参数名（两层文件审查），不能只验证渲染结果。Bug 症状出现在区域 X 不代表根因在 X — 先 grep 确认再写 AC，排除 fallback 造成的误诊。
