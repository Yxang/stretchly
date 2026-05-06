# 技术约束发现：Claude Code agent shell 无 display 访问

- **编号**：035
- **时间**：2026-05-07 01:00
- **阶段**：技术约束发现
- **涉及角色**：tech-qa-t203、architect

## 发生了什么

T-203 tech-qa 阶段发现 Claude Code agent shell 无法访问 macOS 屏幕，即使主机有 display。

### 失败现象

**screencapture 命令**
```bash
screencapture -x /tmp/test.png
# exit 1: "could not create image from display"
```

**webContents.capturePage via CDP Page.captureScreenshot**
- 超时（页面渲染在 headless shell 中不产生帧）
- agent 内 Electron 进程无法调用原生 macOS 截图 API

## 根因确认

架构师独立验证同款失败，确认为 Claude Code agent 沙盒结构性限制，非：
- 环境配置问题（DISPLAY/PATH/权限设置）
- agent 误判或临时状态
- 特定工具选择问题

**结论**：agent 沙盒隔离了对主机屏幕的访问权。

## T-202 vs T-203 差异分析

**T-202 截图获取成功** — 可能原因：
- tech-qa-t202 违反 worktree 隔离规则，在主仓库（host 终端）执行 headed 验证
- 获得了 host 终端的 display 访问权（属于越权但意外解锁截图能力）
- 修正流程（dev-log 033）后，tech-qa 必须在 worktree 内 + agent shell 内执行
- **display 不可用成为必然**

**启示**：plan 阶段需要早期声明证据形式，避免后期被迫降级。

## 对 v1.22 的影响

**无**。T-203 采用文本+日志+静态分析三段式证据通过验收（option B）：
- 日志输出验证变更影响
- 静态代码分析验证逻辑路径
- 运行时日志追踪边界条件

plan 红线「不强制用户做 headed 验收」未违反。

## v1.23+ Plan 阶段修订建议

### §9 截图标准改为「证据标准」

明确接受三种形式，任一即可：
1. **视觉截图**（before/after 对比）— 用户 PQ 或 host 主机 headed 环境提供
2. **文本+日志+静态分析三段式** — tech-qa agent 内原生支持
3. **二者组合** — 关键路径视觉 + 其他路径文本

### AC L3 标注时必须声明

当 AC 涉及 L3（UI 时序 / 反馈可视性）时：
- 必须同时声明：「能否在无 display 环境验证？」
- 若必须视觉则明确委派给用户 PQ（并在 PLANNING.md §7「user worktree」明确声明）
- 若可接受文本证据则指定替代验证方案

### plan §6 红线重新解读

「不强制用户做 headed 验收」与「无 display tech-qa 必须降级证据」组合：
- 用户不下场 ✓（不被强制做 headed）
- tech-qa 不被迫降级 ✗（必须降级证据形式，但可选三种)
- 解决方案：plan 阶段精准声明证据形式，避免后期被动适应

## 教训

- 沙盒隔离是架构特性，非临时限制，需在 plan 初期纳入约束清单
- 越权违规（dev-log 033）虽然被修正，但侧面暴露了沙盒隔离的真实存在
- 证据形式降级不等于质量降级，关键是 plan 阶段的前置声明

## Pattern Note

🔁 沙盒隐性约束：与 v1.21 工具选型争议同源，通过 v1.22 早期发现规避了后续版本的反复冲突。本次发现的结构性限制应写入 CONSTITUTION.md（跨版本约束文档）。
