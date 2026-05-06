# F-301 PQ 升级 — Electron binary 复用方案

- **编号**：030
- **时间**：2026-05-06 21:31
- **阶段**：决策
- **涉及角色**：架构师

## 发生了什么

架构师批准 F-301 PQ 升级关键决策：Electron binary 复用方案，规避 worktree 多重下载。

## 决策（如有）

**决策内容**：设置环境变量
```bash
export ELECTRON_OVERRIDE_DIST_PATH=/Users/yxang/GitMine/stretchly/node_modules/electron/dist
```

**理由**：v1.22 期间，多个 worktree 并行执行会触发 Electron 41.5.0 重复下载（～600MB × N worktrees），造成带宽和时间浪费。通过全局 env 变量指向主仓库的 `node_modules/electron/dist`，所有 worktree 复用单份 binary。

**约束**：
- 仅在本项目有效（通过 `.claude/settings.json` env section 或 shell profile 配置）
- 需在所有 worktree 中生效（共享 env 配置）
- Electron 版本变更时需更新路径

## 后续影响

v1.22 期间所有 dev/tech-qa worktree 启动时自动复用 binary。
避免了预估 5-10 分钟的多次重复下载。

## Pattern Note

🔁 工具链运维知识累积：本条例与 v1.21 工具选型争议同源，通过提前运维决策规避了并行开发的隐性成本。
