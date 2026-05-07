# Stretchly v1.22 — Quota 模式 5-bug 集中修复

> **目标版本**：v1.22
> **计划日期**：2026-05-06
> **前置版本**：v1.21（quota-scheduling，dev HEAD b2676ba）
> **背景**：v1.21 完整发布并由 Coordinator 在本机 Mac 真机首次启用 quota 模式后，一次手测发现 5 个 PQ 多轮 grep+vitest 全程未捕获的 UI/功能缺陷。统一在 v1.22 团队流程中修复，禁止 hotfix 直接合 dev。

---

## 1. 目标

修复 v1.21 quota 模式上线后真机暴露的 5 个排版/i18n/状态机缺陷，让 quota 模式从"代码层完整"转为"用户实际可用"。同时把 PQ 流程从"自动 grep+vitest 自报通过"升级为"per-task tech-qa headed 截图证据 + 防回归 vitest 用例 + LESSONS 教训沉淀"，在框架层堵住下次再 5-bug-slip 的口子。

---

## 2. 现状分析

**v1.21 已合并（dev HEAD b2676ba）**：
- BreaksPlanner quota 模式核心 + QuotaManager + 三档阈值 sanitize（路径 B γ all-or-nothing + cascade）
- Preferences UI quota 段 + advanced 子段 + T018 help `<details>` 折叠
- Tray quota 进度 tooltip + reset-quota 命令（菜单/快捷键/CLI）
- 51 个 i18n 英文键（quota.preferences / quota.tray / quota.softReminder / quota.help）
- 73 vitest quota 用例 + 404 全项目通过

**真机测试暴露的 5 缺陷**（用户 2026-05-06 在 macOS arm64 build `dist/mac-arm64/Stretchly.app` 验证）：

| # | Bug | 文件 | 根因 | 严重度 | T 任务来源 |
|---|-----|------|------|--------|-----------|
| 1 | Quota help 区在 preferences 中挤成竖条 | `app/css/preferences.css` | `.schedule > div` 选择器只匹配 div，T018 引入的 `<details>` 没拿到 `grid-column: 2/-2` | P0 | T018 |
| 2 | Advanced options 区排版乱 + 没 i18n | `app/css/preferences.css` + `app/preferences.html` | `.quota-advanced-content` 同样的 grid 选择器 miss + 部分文案硬编码英文 | P1 | T009 |
| 3 | zh-CN 缺整个 `quota.*` 命名空间 | `app/locales/zh-CN.json` | T011 只交付 en，~60 key 中文翻译漏发 | P2 | T011 |
| 4 | 切 quota 模式后必须重启 app 才生效 | `app/breaksPlanner.js` + `app/main.js` | `schedulingMode` 在 `BreaksPlanner` constructor 读一次（line 22）；`save-setting` IPC 不重建 planner | P0 | 架构遗漏 |
| 5 | 软提醒倒计时显示 `{{count}}s` 字面量 | `app/soft-reminder-renderer.js:55` | i18next 调用传 `{ seconds }`，模板 key 是 `{{count}}` | P0 | T006/T007 |

**PQ 流程缺陷**（meta-issue）：v1.21 PQ 4 轮 + L4 grep+vitest 全 PASS，5 个真机 bug 全部漏检。LESSONS #6 "Agent self-report green 需 Leader rerun" 已写入但未对 UI 排版/真机 i18n 渲染建立独立验证机制。

---

## 3. 功能需求

### 3.1 核心功能（必须）— P0 Batch 1

| # | 功能 | 描述 | 涉及模块 |
|---|------|------|---------|
| 1 | Quota help 区排版修复 | preferences `<details>` 占满 schedule grid 第 2 列 | `app/css/preferences.css` |
| 2 | 切 quota 模式立即生效 | 用户在 Preferences 切 `schedulingMode` 后，无需重启 app，tray/scheduler/quotaManager 自动重建并按新模式运行 | `app/breaksPlanner.js`、`app/main.js`、`app/utils/statusMessages.js` |
| 3 | 软提醒倒计时正确渲染 | i18next 调用参数与模板占位符对齐，倒计时显示 `Closing in 5s` 而非 `Closing in {{count}}s` | `app/soft-reminder-renderer.js`、`app/locales/en.json`（如需统一名称） |

### 3.2 重要功能（应该）— P1+P2 Batch 2

| # | 功能 | 描述 | 涉及模块 |
|---|------|------|---------|
| 4 | Advanced options 区排版 + i18n 补全 | `.quota-advanced-content` 子项占满 grid 第 2 列；硬编码英文字段全部接入 i18next | `app/css/preferences.css`、`app/preferences.html`、`app/locales/en.json` |
| 5 | zh-CN quota.* 全量翻译 | `app/locales/zh-CN.json` 补 `quota.preferences` / `quota.tray` / `quota.softReminder` / `quota.help` 全部 ~60 keys（含 P1 advanced 新增 keys） | `app/locales/zh-CN.json`（必须）；其他 locale 由 Crowdin 后续异步处理 |

### 3.3 锦上添花（可选）

无。本版本严格限定为缺陷修复 + 流程改进，不引入新功能。

---

## 4. 非功能性需求

- **性能**：planner 热重建必须在 50ms 内完成，不引入用户感知的卡顿；切模式时正在进行的 break 窗口应被妥当处理（取消未触发的 timer，正在显示的 break 不强制关闭）。
- **兼容性**：所有现有 v1.21 持久化 settings 字段保持向后兼容；用户已配置的 quota 阈值不被 reset。
- **i18n fallback**：zh-CN 缺译时仍能 fallback 到 en（i18next 默认行为不退化）。
- **测试覆盖**：每个 bug 必须有 1+ vitest 防回归用例（CSS 排版除外，UI 通过 tech-qa headed 截图验证）。

---

## 5. 范围边界

**本版本包含**：
- 5 个真机 bug 的根因修复（P0 三个 + P1 一个 + P2 一个）
- BreaksPlanner / main.js 之间增加 `schedulingMode` 切换的 IPC 联动
- 防回归 vitest 用例（针对 Bug 4 planner 切换 + Bug 5 i18next 渲染 + StatusMessages 在新 quotaManager 下的 trayMessage 输出）
- zh-CN.json 全量补译
- PQ 流程升级（详见交付期望第 9 条）

**本版本不包含**：
- 新功能（任何 quota 模式之外的扩展）
- 其他 locale（zh-TW / de / fr / es / ja / pl / pt-BR / ru / ko 等）的 quota.* 翻译 — 走 Crowdin 异步流程，不阻塞 v1.22 发布
- v1.21 LESSONS 候选 12 条的常规毕业评审 — 留 v1.23 Phase 6 Checkpoint
- ACCEPTANCE.md 15.7 文案 revise（已在 v1.21 PLANNING 关键跟踪记录，留 v1.23）
- 任何 release 渠道（Homebrew / winget / Microsoft Store / Snap / MAS）的发布流程 — 自用 fork，本地构建即可

---

## 6. 技术上下文

### 现有代码可复用部分

- **`app/utils/statusMessages.js`**：已有 quotaManager 双行 tooltip 拼接逻辑；planner 热重建后只需重新 `new StatusMessages({ breakPlanner, quotaManager: breakPlanner.quotaManager })`，trayMessage getter 自动用新引用。
- **`app/utils/quotaManager.js`**：已有 `start()` / `stop()` / `getState()` 接口；planner 的 `set quotaManager` setter 已经支持替换。
- **`app/breaksPlanner.js`** 已有 `_installQuotaManager` / `quotaManager` getter/setter — 热重建可以走 `set schedulingMode(value)` 触发 stop 旧 quotaManager + new QuotaManager(...) + emit('quotaManagerReplaced')。
- **vitest 73 quota 用例**：作为防回归基线；Bug 4 / Bug 5 新增用例追加到 `test/breaksPlanner.js` 和（新建）`test/softReminder.js`。

### 技术约束

- **不能 hotfix**：用户明确禁止；必须走完整团队流程（architect 设计 + per-task dev + CR + tech-qa + PL/PQ + merger）。
- **不引入新依赖**：i18next、electron-store、vitest 已在 v1.21 锁定；不动 package.json 的运行时依赖。
- **Bug #4 修复路径 = B（热重建 planner）**：用户已确认。不接受 A（重启 dialog）。
- **Bug #5 修复方向**：保持 i18next 模板 key `{{count}}`（i18next 标准 plural variable），改 `soft-reminder-renderer.js` 调用方传 `{ count: seconds }`。如果 zh-CN 的 plural rule 需要不同 key，由 PL 在 Batch 2 决定。
- **StandardJS lint + 2-space ESM**：所有新代码遵守现有规范；husky pre-commit `npm run lint` 必须通过。
- **vitest pool=forks + 单文件运行**：新增测试不能依赖其他测试的运行顺序。

### 用户已确认的决策

| 议题 | 决策 |
|------|------|
| Bug #4 修复策略 | B：热重建 planner（不做 A 重启提示） |
| zh-CN 翻译范围 | 全量 ~60 keys（含 advanced + help） |
| PQ 改进 | dev/tech-qa headed + 截图证据 + 防回归 vitest + LESSONS 教训沉淀（**不**强制用户做 headed 验收） |
| Batch 策略 | 两批：P0（Bug 1/4/5）先合 → P1+P2（Bug 2/3）后合 |

---

## 7. 已知风险与开放问题

| # | 问题/风险 | 状态 | 影响 | 备注 |
|---|----------|------|------|------|
| 1 | Bug #4 热重建可能在切模式瞬间正在显示 break 窗口 | 待确认 | 中 | 架构师定策略：用户切模式时若 break 在显示，是先关 break 再重建，还是延迟到下次 break 结束后重建 |
| 2 | StatusMessages 在 `quotaManager` null → 新建过程中可能拿到陈旧引用 | 待确认 | 中 | 架构师定接口：planner emit `quotaManagerReplaced` 时 main.js 主动 refresh tray menu |
| 3 | zh-CN 新增键值的语言风格 | 待确认 | 低 | PL 主导；建议参考现有 `app/locales/zh-CN.json` 的语气（半正式，使用「您」） |
| 4 | i18next plural rule 在 zh-CN 是否需要不同 keys | 待确认 | 低 | 中文无单复数；保留单一 `{{count}}` 模板即可，无需 `_plural` 变体 |
| 5 | Bug #2 advanced 部分硬编码英文究竟有多少 | 待确认 | 低 | dev T-202 在 worktree 中 grep 确认；如超出 5 处需向 architect 上报范围扩张 |
| 6 | tech-qa headed 截图存储位置 | 待确认 | 低 | 建议 `docs/dev-log/screenshots/T<NNN>-<short>.png`，由 chronicler 归档 |
| 7 | PQ L4 是否仍需 Coordinator 真机 smoke | 待确认 | 中 | 即使流程升级，最终用户验收建议保留；由 PL 在 ACCEPTANCE.md v1.22 段落明确 |
| 8 | LESSONS 沉淀新条目数量 | 待确认 | 低 | 至少 1 条："per-task tech-qa 必须在 worktree headed Electron 启动并截屏 UI 改动" |

---

## 8. 交付物

| # | 交付物 | 形式 | 说明 |
|---|--------|------|------|
| 1 | dev 分支 v1.22 合并完成 | git commit (squash to dev) | Batch 1 + Batch 2 两次合并；架构师批准、merger 执行 |
| 2 | 真机可用的 macOS arm64 build | `dist/mac-arm64/Stretchly.app` | Coordinator/CEO 本地 `npm run dist` 产出，5 bug 全部消失 |
| 3 | 完整 i18n 覆盖（en + zh-CN） | `app/locales/en.json` + `app/locales/zh-CN.json` | quota.* 命名空间双语对齐 |
| 4 | 防回归 vitest 用例 | `test/breaksPlanner.js` 增量 + 新建 `test/softReminder.js` 或 `test/i18nRendering.js` | 至少覆盖 Bug 4（schedulingMode 热切换）+ Bug 5（i18next count 参数渲染） |
| 5 | tech-qa headed 截图证据归档 | `docs/dev-log/screenshots/T<NNN>-*.png` | 每个 P0 bug 必须有 before/after 截图 |
| 6 | 升级版 PLANNING.md / ACCEPTANCE.md | `docs/team/PLANNING.md` v1.22 段落 + `docs/team/ACCEPTANCE.md` v1.22 段落 | architect / PL 撰写；含本版本所有 AC |
| 7 | LESSONS 新条目 | `docs/LESSONS.md`（技术区 + 产品区各加 1-2 条） | 至少含"tech-qa 必须 headed 截图"+"i18next 参数名与模板 key 强制对齐" |
| 8 | dev-log 023 + CHRONICLE 更新 | chronicler 维护 | v1.22 完整迭代轨迹 |

---

## 9. 交付期望

- **每个 P0 bug 在真机 macOS arm64 上手动验证消失**：用户在 `dist/mac-arm64/Stretchly.app` 启动后，能正常切 quota 模式不重启、能看到 quota help 区正确占满宽度、能看到软提醒倒计时正常显示秒数。
- **没有引入新的回归**：v1.21 73 vitest quota 用例 + 404 全项目用例 100% PASS。
- **PQ 不再发生 5-bug-slip 模式**：v1.22 PQ L4 完成时，每个 P0/P1 bug 必须附 tech-qa headed 截图（before/after），不接受单纯 grep+vitest 自报通过。
- **zh-CN 切换后 quota 模式完整可用**：用户切语言到中文，preferences quota 段所有 label/help/advanced 子项无英文遗漏字符串。
- **planner 热重建不破坏正在进行的 break**：切模式瞬间若有 break 窗口在显示，按架构师确认的策略处理（不强制关闭就是不强制关闭，留给架构师定）。
- **代码符合现有规范**：StandardJS lint pass，husky pre-commit 不被绕过，conventional commits 格式。
- **流程教训沉淀**：v1.22 close-out 时 LESSONS.md 至少新增 1-2 条针对本次 bug-slip 的软规则。

---

## 附录 A：5 Bug 根因 → 修复点速查

```
Bug 1 (P0)  app/css/preferences.css:545+
            添加：.schedule > details { grid-column: 2/-2; }
            或：把 .schedule > div 改为 .schedule > div, .schedule > details

Bug 2 (P1)  app/css/preferences.css + app/preferences.html
            .quota-advanced-content 子项 grid 修复
            硬编码英文 → data-i18next 属性 + i18n keys

Bug 3 (P2)  app/locales/zh-CN.json
            从 en.json 拷贝 quota.* 整树，逐句翻译

Bug 4 (P0)  app/main.js:1797-1812 (save-setting handler)
            app/breaksPlanner.js:22 (schedulingMode 一次性读取)
            app/utils/statusMessages.js (quotaManager 引用)
            修复方向：planner 提供 setSchedulingMode() 方法，
                     main.js 在 save-setting 中调用，
                     setter 内部 stop 旧 quotaManager + new QuotaManager
                     + emit('schedulingModeChanged') → main.js refresh tray

Bug 5 (P0)  app/soft-reminder-renderer.js:55
            window.i18next.t('quota.softReminder.closingIn', { seconds })
            → window.i18next.t('quota.softReminder.closingIn', { count: seconds })
```

## 附录 B：建议任务拆分（架构师确认）

**Batch 1（P0，目标 dev HEAD <SHA1>）**：
- T-201 Bug 1 CSS 修复 + tech-qa headed 截图（5 行变更）
- T-202 Bug 5 i18next 调用对齐 + 防回归 vitest（5 行变更 + 1 测试）
- T-203 Bug 4 planner 热重建（架构师设计接口 → dev 实现 → tech-qa 边界测试 + 防回归 vitest）

**Batch 2（P1+P2，目标 dev HEAD <SHA2>）**：
- T-204 Bug 2 advanced CSS + i18n 补全（dev + tech-qa headed 截图）
- T-205 Bug 3 zh-CN 全量补译（PL 主导 + dev 落 JSON）

**流程升级（贯穿）**：
- F-301 PQ 流程文档化：每个 P0/P1 task 的 tech-qa AC 必须含 headed Electron 启动 + UI 截图（PL 写入 ACCEPTANCE.md v1.22 头部）
- F-302 LESSONS 新增 1-2 条（架构师 + PL 在 close-out 阶段写入）
