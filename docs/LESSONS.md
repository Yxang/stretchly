# LESSONS

> 项目级软规则。始终加载。≤ 50 行。
> 向下退回：2+ 周未触发 → 从本文件移除，knowledge 保留。

## 技术区

- **持久化字段 + 语义约束**：读取点必须 sanitize（非有限 / 负数 / 枚举外 / 单调性），UI 层校验不可信。→ `docs/knowledge/design-tier-sanitize-strategy.md`
- **规格多轮变更后，字面执行 vs 结论文字必须核对一次**：发现矛盾立刻请 Coordinator 做 X/Y 输出-only 锁定，不能假设 Final Call 就是正确。
- **Batch 合并后必须 shutdown sweep**：架构师清点所有 per-task agent（dev/CR/tech-qa），未 shutdown 的会在后续任务广播中 auto-claim。
- **per-task agent 关闭时机 = 该 agent 视角任务结束**：CR ACCEPT 后即可发 shutdown_request（包括 dev/tech-qa），不等合并完成。
- **per-task agent SHA 汇报须附 `git rev-parse HEAD`**：避免 context 漂移导致 SHA 错位误导审阅。
- **worktree 内 lint scope 需限定**：StandardJS 的 `.standardignore` 在 worktree 不会被自动 include，需 `--root` 限定或临时迁移。
- **TaskCreate 预录任务必须 owner + blockedBy 预锁**：空 owner 会被 stray agent auto-claim。
- **Agent self-report green 需 Leader rerun**：tech-qa / dev 自报通过不是 canonical；架构师或 CR 在独立环境 rerun 才算标准。

## 产品区

- **规格定稿前必须逐行算法验证**：PL 定稿含标准表的规格前，必须按算法逐行手算验证，确保表中每行输出与算法定义一致，再发出。「算法正确但表错」会导致 dev/tech-qa 多轮返工。
- **规格变更必须经 Coordinator 统一路由**：PL 的规格裁决和验收标准变更必须经 Coordinator 统一路由后再到达 dev/tech-qa/architect，禁止 PL 直接发给技术侧 per-task agent，避免多方收到矛盾指令。
- **i18n bug AC 必须两层覆盖（模板 key + 调用方参数名），且先 grep 确认症状根因再写 AC**：调用方传 `{ seconds }` 而模板用 `{{count}}` 是独立错误，仅验证渲染结果不能发现。症状出现在区域 X 不代表根因在 X（可能是另一 bug 的 fallback side-effect）— 先 grep 再写 AC，防止误诊造成 AC 范围膨胀。→ `docs/knowledge/product-i18n-ac-precision.md`
