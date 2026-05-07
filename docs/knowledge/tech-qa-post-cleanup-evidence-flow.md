# Tech-QA Worktree 清理后的「补 Evidence」流程

**来源事件**：v1.22 / dev-log 041 / tech-qa-t205 boundary 违规升级

**触发场景**：
- worktree squash merge 到 dev 后被删除（cleanup）
- tech-qa 想补充某条证据（测试日志、静态分析结果、补充截图说明等）
- 发现有关键信息在 merge 后才补充出来

---

## 错误做法 ❌

**直接推送到 dev 分支**：
```bash
git checkout dev
# ... 编辑文件 ...
git commit -m "补充证据"
git push origin dev
```

**为什么错**：
- 违反 git-workflow.md § 27：「永远不要直接 push 到 main 或 dev」
- dev 分支只有架构师和 merger 可推（worktree agent 禁止）
- 会造成非法 commit 进入 dev 历史（如 dev-log 041 的 268e493）
- worktree 被清理后无法 revert（无法追溯原始分支）

---

## 正确做法 ✓

**把补充内容发给 chronicler，由 chronicler 在 dev-log 中追加**：

### 第 1 步：tech-qa 准备补充内容

整理补充的证据（可包含多种形式）：
- 测试执行日志片段
- 静态分析工具输出
- 代码路径验证截图（文本形式）
- 补充说明或异常发现

### 第 2 步：发送给 chronicler

通过 SendMessage 传达补充内容：
```
To: chronicler
Summary: T-XXX 补充证据

补充事项：
- 原 dev-log 号：NNN
- 补充内容描述：[具体内容]
- 原因：[为什么要补充]
- 时间戳：[事件发生的准确时间]
```

### 第 3 步：chronicler 追加记录

**不修改 git 历史**，而是在 dev-log 已合并条目下追加补充段落：

```markdown
## 补充事项（<YYYYMMDD-HHMM>）

[补充的证据内容]
```

或创建新的引用条目：

```markdown
[NNN-supplement-20260507-0300-T205-evidence-addendum.md]
```

### 第 4 步：提交变更

chronicler 执行单独的 commit：
```bash
git add docs/dev-log/
git commit -m "docs(dev-log): supplement evidence for T-XXX (dev-log NNN)"
```

---

## 为什么不修改 git 历史

1. **可溯源性**：每个 commit/合并是一次关键时间点，记录当时的状态
2. **审计链**：补充内容与原事件分离，清晰标记「事后补充」vs「原有记录」
3. **避免污染**：不破坏 dev 分支的 squash merge 合并策略
4. **流程一致性**：所有非代码变更都通过 dev-log 体系记录，不入 git 历史

---

## 同类前例

| 版本 | 事件 | 形式 | 问题 |
|------|------|------|------|
| v1.22 | dev-log 033 | tech-qa-t202 在主仓库写文件 | 源文件污染（未 commit） |
| v1.22 | dev-log 041 | tech-qa-t205 直接 commit 到 dev | git 历史污染（268e493 + 3f921cd revert） |

**共同模式**：tech-qa worktree 在任务边界外进行操作 → 需在 agent prompt 层面预防

---

## 改进措施（arch 待评估）

**v1.23+ 实施**：

1. **Tech-QA Agent Prompt 强化**：
   - 在 spawn prompt 中添加硬要求：worktree 清理前必须检查所有证据已提交
   - 明确「worktree 删除后无法补充」的约束

2. **PreToolUse Hook**：
   - 阻止 per-task agent 在 dev/main 分支执行 git commit
   - 返回错误消息：「禁止直接 commit 到 dev/main，必须在 task 分支操作」

3. **Dev-Log 体系文档化**：
   - 在 dev-log/_INDEX.md 中说明「补充流程」
   - 模板化补充条目格式

---

## 记忆点

- **worktree 是一次性的**：清理后不能补救
- **dev 分支是只读的**（对 per-task agent）：不能直推
- **证据补充走 dev-log 体系**：不走 git 代码库
- **早期预防比事后修正重要**：agent prompt + hook 双重防护

