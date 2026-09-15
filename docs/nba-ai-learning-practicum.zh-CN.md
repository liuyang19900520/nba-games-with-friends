# NBA 项目：低成本 AI 工程学习实践方案

版本：2026-09-12。状态：学习与实现计划，尚未实施其中的功能。

配套材料：[RobotLife 长期技术路线](/Users/lijiao/Max-Robotlife/robotlife/010-Knowledge/011-IT/00-技术路线.md)。两份材料共享 R0–R6 阶段编号。本文件负责项目实践；已有 [Serverless 设计书](serverless-architecture-design.zh-CN.md) 保留详细审计和架构背景。本文件调整学习顺序，并纠正其中部分选型前提。

## 1. 学习目标与项目边界

项目用于个人展示，Stripe 只用测试模式；数据允许约 15 分钟延迟并由用户按需更新；任意五名不同球员组成阵容；好友榜属于 MVP；AI 阵容生成消耗 credit；保留 Supabase Free，尽量让应用没有固定月费。NBA 代理已有费用单独记录。

这次目标是通过 NBA 学会一条完整交付链：需求 → 数据 → 确定性业务 → LLM → 评估 → 工具与审批 → 部署运维。功能复杂度必须服务于一个可说清的学习目标。

第一版需要的产品闭环是：

```text
管理员刷新比赛数据
  → 两个真实测试账号互加好友
  → 用户选择五人 / 用 credit 获得 AI 推荐
  → 用户确认并提交
  → 刷新后结算比赛得分
  → 展示好友当日排行榜
  → Stripe Test Checkout 补充 demo credits
```

AI 工程的后续演示是：“为什么推荐这五人”带可核对证据；Agent 能调用受限工具生成草稿、等待用户确认并恢复提交；输入阵容截图可提取草稿，但必须由用户核对。

## 2. 对现有设计做的修正

1. **主线优先学习、可验证的结果。** 云端长期保留 Vercel Hobby + Supabase Free；Kafka/Kubernetes/AWS/Agent runtime 的学习允许在独立实验中完成，不把所有实验都变成线上依赖。
2. **Vercel 60 秒不是统一平台硬上限。** 当前官方 duration 文档写明，启用 Fluid Compute 的 Hobby 为 300 秒。原设计书引用了旧计划页面。本项目仍可把快刷预算设为 20–60 秒，但这是主动设定的体验与费用预算；部署时核对真实项目设置。[Vercel duration](https://vercel.com/docs/functions/configuring-functions/duration)
3. **Supabase Free 不等于数据库自动缩零再唤醒。** 它是托管 PostgreSQL 免费档，低活跃可能暂停，需要恢复。这里的 Serverless 目标是无需运维常驻服务器，不承诺每个底层服务都按调用量计费。[Supabase pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
4. **按需刷新有两层。** 普通用户可以重新读取数据库缓存；管理员可以触发耗用 NBA 代理的上游同步。只有需要公开自助刷新时才增加共享 15 分钟冷却、并发合并和服务端配额。页面加载本身不会自动触发付费上游调用。
5. **先学评估再加 Agent。** 允许为了学习实现一个受控 Agent 实验，但是否替代线上单次调用由测试效果和成本决定。
6. **SQL 是统计真值入口。** RAG 用于新闻与解释证据，不能把得分、余额、好友权限交给向量检索或 LLM 决定。
7. **不把历史说明写成已验证能力。** 现有 RobotLife 项目说明包含旧 EC2、多 Agent 和“避免幻觉”等表述；作品集应根据实际运行版本和 eval 结果重写，不能由框架名称推导正确率。

## 3. 现有代码怎样变成学习材料

以下来自 09-10 审计和 09-12 源码抽查。并非已经修复，也未重新执行全量云审计。

| 现有位置 | 值得学习的问题 | 练习结果 |
|---|---|---|
| `apps/web/src/app/api/payment/create-session/route.ts` | 不能信任客户端 userId、priceId 和 Origin | 以真实 session 派生身份、服务端测试产品映射 |
| `functions/payment/migration_v3_credits.sql` | RPC 权限、事务、并发余额与幂等 | credit ledger 与 reserve/commit/release |
| `apps/web/src/app/api/payment/webhook/route.ts` | Webhook 重放、双写、中途失败 | 同一测试事件反复到达只发放一次 |
| `services/data-sync/utils.py`、`worker.py` | 重试预算、领取任务、长任务恢复 | 有截止时间、lease 和 checkpoint 的一次性任务 |
| `.github/workflows/nba-data-sync.yml` | 本地文件还包含 schedule 和 sync-all | 后续改为手动、参数受控、可重复执行的同步 |
| `apps/web/src/lib/ai/predictionService.ts` | 单模型调用、固定模型名、缺少对照评估 | provider adapter、schema、版本、eval |
| `apps/web/src/app/api/lineup/generate/route.ts` | 当前主要按 fantasy_avg 排序并有人工延时 | 确定性评分 + 有证据的 AI 解释 |
| `apps/web/src/components/features/matchups/MatchupsPageClient.tsx` | 好友榜是 mock | 两个测试用户、双向关系与真实每日榜 |
| `services/ai-agent` | 旧 LangGraph 能力如何与简单 workflow 比较 | 只复用纯数据工具，单独做 runtime 实验 |

不要一次性修全部目录。每个阶段选择一条用户链路，完成它的关键验收后再展开。以下路径都是规划中的代码位置，未创建的路径不代表已实现。

## 4. 最低成本运行方式

| 场景 | 执行位置 | 为什么 |
|---|---|---|
| 日常代码学习、单元测试 | 本机 | 无 API 费用；快速反复调试 |
| SQL/RLS/事务测试 | 本地 Supabase/Postgres | 使用合成账号，不拿真实用户数据做故障实验 |
| 对外展示 Web/API | Vercel Hobby | 已有技术栈，个人非商业场景使用免费配额 |
| 数据/Auth/少量对象文件 | Supabase Free | 数据和身份不迁移；控制数据库与存储容量 |
| Python 数据更新 | 先本机 CLI，再 GitHub Actions 手动任务 | 公开仓库标准 runner 免费；无持续调度与上游消耗 |
| 模型质量对照 | 本机 eval，少量真实模型 API | fixture 用于工程回归，真实 API 用于效果验证 |
| MCP/长时审批 Agent | 本机 stdio / 一次性进程 + 持久状态 | 暂停时释放进程；恢复时加载状态，不长期占用函数 |
| AWS / Kubernetes / Kafka 实验 | 临时 AWS 资源 / 本地 Docker | 产生可解释的实验报告，完成后停止或清理 |

[Vercel Hobby 条款](https://vercel.com/docs/plans/hobby)、[GitHub Actions 计费](https://docs.github.com/en/actions/concepts/billing-and-usage)、[Supabase 价格](https://supabase.com/pricing)是本次免费基线的依据。免费额度适用范围必须遵守；GitHub Actions 用于有限、按需的项目同步与演示，不能当作无限生产计算额度。

建议预算政策，而非供应商报价：固定应用平台 $0/月；模型、embedding、搜索的新增学习预算每月最多 $3；需要 AWS 实验的月份额外预留最多 $2。代理、已有 AI 编程订阅、域名不在这 $5 内。金额不是已经开通的付费授权，也不是已设置的硬限额。

成本公式：`月成本 = 代理合同费用 + 域名/DNS + API 实际用量 + 实验资源用量 + 配额外费用`。代理是包月还是按流量尚未核实，因此不能声称停用展示后代理也不收费。

所有模型调用应记录 token 和单价版本。应用在服务端保留预算，接近额度时禁止新任务；供应商支持硬限额时一并启用。仅有 billing alert 不会自动停止消费。旧 AWS EBS、Secret、DNS、镜像和日志也可能单独收费，清理前按实际资源核对。

为了防止 demo credits 被用于刷真实模型费用，测试支付可以完整演示，但在线 AI 要另有独立调用配额：建议每用户每日 2 次、整个展示项目每日 10 次真实生成，另配共享美元预算。读取缓存不新增模型调用。credits 是产品权益；API 配额是运营控制，两者要分开。

## 5. R0–R6 实践表

预算与长期路线相同，总计 160 小时。按每周 4 小时约 40 个有效学习周。实际基础不足时延长周期；不要通过略过安全和验收来赶时数。

| 阶段 | 小时 | 产品结果 | 要掌握的机制 | 退出条件 |
|---|---:|---|---|---|
| R0 | 12 | 可复现的受控测试环境 | 需求、HTTP/Auth、数据边界 | 一个真实失败有自动化复现；能讲清三条不变量 |
| R1 | 20 | 按需同步、最小好友榜、测试 credit 闭环 | 事务、任务状态、幂等、RLS | 重放不重复发放；两个账号看见正确榜单 |
| R2 | 24 | 数据评分 + LLM 解释 | schema、baseline、token、eval | 固定测试集有质量与成本报告 |
| R3 | 24 | 有来源的新闻/伤病解释 | 直接上下文/FTS/向量比较 | 有对照结果，选择是否上线检索 |
| R4 | 32 | 可暂停恢复的阵容助手与 MCP 实验 | tool contract、审批、checkpoint | 未批准不写入；重复恢复不重复提交 |
| R5 | 24 | 截图草稿 + 可靠展示 | 多模态、trace、CI、回滚 | 模糊图片可拒绝；上游失败可降级 |
| R6 | 24 | AWS 短期实验和迁移说明 | SQS/Lambda/S3/IAM/Terraform | 故障与清理有证据；能解释迁移取舍 |

### R0：建立可以理解的基线，12 小时

阅读指定文件并画出三条链路：登录→选人；测试购买→credit；预测→模型。使用一场固定历史比赛、十名候选球员和两个合成账号作为 fixture。

写下至少三条不变量：用户不能修改他人数据；同一个测试支付事件只发放一次；一个阵容是同一比赛日的五名不同且合资格球员。任意五人表示没有位置/工资帽约束，不表示允许重复球员或没有比赛的人。

本地创建最小测试入口，确认 dependency lock 与构建环境。先复现一个已知问题，例如用非本人身份创建支付 session，或把扣 credit 请求重放。任何测试只对本地/测试环境执行。

学习者亲手完成：画信任边界、写失败断言、追踪该断言为什么失败。AI 可以帮助准备脚手架。

成果：一页需求、一个 fixture、一个从失败转成功的测试。未完成关键修复前，只在本地演示。

### R1：把数据、好友与 credit 做成真实闭环，20 小时

将这些工作限制在最小可演示范围：

1. 修复 Checkout 身份、测试价格映射、Webhook 签名与事务发放。RPC 固定权限与 search_path，退款/释放通过原子操作完成。
2. 同步 CLI 接收有限 mode/date/game_id。任务记录 `id/status/attempt/lease_until/checkpoint/error_code`；设置有限尝试和总超时。
3. 重复点击返回正在运行的同一任务；成功写入数据后更新 freshness。普通页面刷新只读取缓存，管理员更新才访问上游。
4. 同一事务写业务变化与 outbox；处理器处理 `game_final` 后写结算快照。初期按需执行处理器，下一次刷新可重放未完成事件。
5. 两个测试账号发送/接受好友请求；每日榜只显示自己和已确认好友；先不做查找推荐、聊天、邀请邮件和赛季榜。

核心表：复用 `friendships`、`user_daily_lineups`、`lineup_items`，补足约束；新增或演进 `credit_ledger`、`job_runs`、`domain_events`、`lineup_scores`。不同时维护两套 queue truth。

至少演练：重复事件；更新成功但响应丢失；job 在半途退出；用户 A 请求 B 的私有数据。目标是这些预定义测试全部通过，不能外推为所有故障都已覆盖。

学习者亲手完成：一个事务 RPC 和重放测试。解释“至少一次处理 + 幂等副作用”为什么比宣传全链路 exactly-once 更准确。[AWS outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)

对象存储在此只学一个用途：保存小型原始 NBA 响应快照，数据库存 `object_key/hash/fetched_at/source`，便于重放。用本地文件或 Supabase Storage 即可；不为此增开 R2/S3。

### R2：上线第一个可以衡量的 AI 功能，24 小时

先实现三个对照：A 为现有赛季 fantasy_avg Top 5；B 为有版本的确定性评分 Top 5；C 为 B + LLM 解释。程序决定选人和统计数值，模型负责解释依据和不确定性。

评分初稿可以使用标准化后的赛季均值、最近五场、可用性、比赛对手等特征。**初始权重只是待测试的启发式，不宣称预测有效。** 若缺伤病或上场时间数据，说明缺失并使用 fallback，不能让模型补造数值。

模型返回 schema，例如 `player_ids`、`reasons`、`evidence_ids`、`data_as_of`、`warnings`；输出仍经服务端校验。删除假等待，页面展示真实步骤状态。AI 解释失败时保留确定性阵容但释放 credit。

credit 使用唯一 request/artifact key 预留，成功后确认消耗；同一用户重复查看同一已解锁结果不再次扣费。必须阻止并发请求和断线重试导致重复推理/扣费。

建议从 24 个独立样例开始：16 个用于开发，8 个留作未参与调参的验收。每组覆盖正常数据、缺数据/旧数据、歧义/不可回答三类。正常样例不是只有一场比赛的不同措辞。后续积累到 50–100 个，无需第一天做庞大平台。

必须区分两种指标：

| 指标 | 怎样验证 |
|---|---|
| 工程正确性 | schema、五人唯一性、引用存在、credit 幂等，预定义用例必须全部通过 |
| 解释可靠性 | 逐条核对数值和证据支持，人工复查；模型 judge 只辅助 |
| 用户价值 | 推荐是否帮助选择、是否说明风险，保留人工反馈 |
| 真正预测能力 | 若展示胜率，单独对历史数据按时间切分，用 Brier score/校准对照 baseline |
| 单位任务成本 | 成功任务成本包含失败尝试、模型、搜索、代理、embedding；同时报告延迟和缓存命中 |

不要用随机切分把同场比赛或赛后新闻放进赛前训练/评估。若没有经过足够样本验证，胜率只能标为实验输出；可以先移除精确概率，只给证据化的赛前分析。

成果：`evals/` 中的 fixtures/expected/checks 规划实现、一次 A/B/C 报告、失败案例与 token 记录。生产 CI 默认跑离线/录制 fixture；真实模型 smoke test 手动触发，避免每次 push 花钱。

### R3：用 NBA 亲自验证 RAG 的价值，24 小时

选取约 30–50 篇有日期和来源的短新闻/报告，先用英文原文。建立 20 个小型检索问题，分别标注相关证据、无答案问题和应排除的赛后证据；开发/留出集分离。中文/日文查询另作为跨语言问题，不能把英文 FTS 的失败直接归因于 RAG。

对同一语料、相同输出模型比较：

- A：日期/球队规则选出足够小的文档集，直接加入上下文。
- B：Postgres FTS + 日期/球队过滤；默认 PostgreSQL FTS 排序不等同于 BM25。
- C：pgvector semantic retrieval；必要时与 B 合并排序，形成 hybrid。
- 可选 D：Agent 根据证据不足再查询一次；每次最多两次检索。

现有 `documents`、`match_documents` 可复用，但先检查 embedding 模型、维度和权限；不同模型向量不能直接混用。用新版本字段或隔离的实验数据，避免破坏原有索引。

所有方案都先做日期和访问权限过滤。测 evidence recall@k、事实支持、正确拒答、输入 token、延迟、费用；手动检查并记录失败样例。全文/向量先离线建一次索引，不为每次提问重复 embedding。[PostgreSQL FTS](https://www.postgresql.org/docs/current/textsearch.html)

预设采纳规则：在留出集上保持权限和事实约束，复杂方案至少解决两个原先失败的真实样例，且成本与延迟在预算内，才考虑上线。小样本只能证明这个 demo 的改善，不能证明行业普遍优势。

成果：一份“为何 NBA 的数值查询用 SQL、新闻是否需要检索”的 ADR。即使最终选择不用向量，实验仍然完成了 Vector Search 的学习目标。

### R4：工具调用、Agent runtime、MCP 与人工确认，32 小时

先用普通代码实现有限工具循环，再使用现有 Python/LangGraph 实验体验持久执行；不恢复旧的常驻 FastAPI/EC2 服务。生产 TypeScript 功能与 Python 实验不同时维护同一套写业务规则，统一通过受控业务 API。

只设计四个工具：

| 工具 | 输入与结果 | 权限与副作用 |
|---|---|---|
| `get_games(date)` | 固定日期的比赛和 data_as_of | 只读公开比赛；限制结果数量 |
| `get_player_evidence(player_ids, as_of)` | 有来源的统计与新闻引用 | 最多 10 名；按访问者和日期过滤 |
| `propose_lineup(date, excluded_ids)` | 五人草稿、理由、证据 | 不提交阵容；排除名单需 schema 校验 |
| `submit_lineup(draft_id, approval_id)` | 提交回执 | 登录用户自己操作；服务器校验审批、版本、锁定时间和幂等 |

禁止提供 `execute_any_sql` 或任意 shell 工具。MCP server 只复用前两个只读工具，先使用本机 stdio；远程 OAuth/HTTP 作为未来需求，不为展示额外部署服务器。工具协议不会自动赋予正确权限。[MCP architecture](https://modelcontextprotocol.io/docs/learn/architecture)

Agent runtime 的最小契约：每次最多 3 轮模型决策、最多 6 次工具调用、一个总 token/时间预算；生成草稿后保存状态并结束进程。用户确认时以同一 run ID 加载状态，不让 HTTP 请求一直等待批准。LangGraph 可以作为 checkpoint/interrupt 的学习载体。[LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)

审批绑定用户、草稿内容 hash、数据版本和有效期。批准后若阵容变更或比赛已锁定，必须重新校验，不复用旧批准。恢复导致节点重跑时，写操作仍只产生一次效果。

五个验收案例：证据缺失能停止；新闻中的“忽略规则”不能变成工具指令；用户拒绝不写入；进程重启后恢复；同一个 approval 回放不重复写入。日志展示工具调用与结果摘要，不伪造或依赖模型内部思维链。

最后用 R2/R3 留出集比较单次 workflow 和 Agent 的成功任务数、成本、延迟。只有 Agent 的动态查询改善了问题覆盖才替代线上路径；否则保留为独立、标明实验性质的展示入口。

### R5：多模态与可靠展示，24 小时

做一个窄多模态入口：“上传阵容截图 → 返回候选球员与不确定项 → 用户确认草稿”。使用自己制作的测试图，控制文件大小、像素数和读取时间；临时文件定期清理。

至少测试十张不同样例：清晰、模糊、重名、遮挡、非阵容图片。衡量字段提取准确率、正确拒绝/追问和用户修正次数。图片中出现的指令不是系统授权，不能直接触发支付或提交。

默认先使用一个低价、支持图像的 API 做小样本验证。端侧或本地模型属于选修：本机内存、设备支持和维护时间尚未核实，不预先承诺免费且效果相同，也不采购 GPU。

把已有产品链路用 trace ID 连接起来：refresh → data_version → prediction/run → credit ledger → submit → settle。日志避免记录完整用户资料、token 或密钥。模型 trace 中记录结构化调用与来源，按需要脱敏。

CI 持续执行基础业务测试、schema/RLS/幂等测试和离线 eval；构建/部署采用明确版本。手动演练：NBA 代理不可用、模型 timeout、数据库暂停、Webhook 重放。记录从日志定位到降级/恢复的过程。

展示支持两种清楚标识的模式：真实日期的缓存数据，以及固定历史比赛 replay。replay 使用隔离的合成账号/状态与模拟时钟，不能把历史结果称作实时预测；它能在休赛期、上游断开时完整演示好友结算。

成果：5 分钟演示、一次故障报告、一次 rollback/恢复记录、当月实际账单。只在所有关键用例通过后公开展示 AI 入口。

### R6：AWS 与云原生短实验，24 小时

NBA 长期展示继续用免费基线。AWS 学习采用独立实验目录和 state，不使用已经漂移的旧 Terraform 直接 apply。

推荐分配：4h Docker/一次性 job；4h IAM/消息语义；8h Terraform + AWS 实验；4h 故障与资源清理；4h 迁移方案和讲解。

AWS 实验只需要 S3、SQS、Lambda 和最小 IAM。使用合成 `game_final` 消息，测试重复消息、坏消息、部分失败、死信与重放。S3 保存不可变输入/结果；输出使用确定性 key 做有限幂等演示，不能据此声称支付副作用已经 exactly-once。

不用 NAT Gateway、EKS、常驻 EC2、GPU 或固定 IP。先查看 plan，设置函数并发和有限消息数；完成后只清理本次明确创建的资源，再核查 queue、bucket、日志、镜像和账单。云预算告警不等于硬关停，不能保证实验绝对不会超支。[Lambda/SQS](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)、[Terraform AWS](https://developer.hashicorp.com/terraform/tutorials/aws-get-started)

如不想产生任何新增云费用，本阶段先做本地事件重放和 Terraform 设计审查，AWS 实机部分延后；材料必须标为“未实机验证”。

最后写一页迁移说明：如果客户要求所有数据留在 AWS、对接现有 Java 订单系统，哪些 API、权限、数据策略和部署方式要变，哪些幂等/eval/tool contract 可以复用。

## 6. 延后或限制范围的技术

| 技术 | NBA 内的低成本学习办法 | 进入条件 |
|---|---|---|
| Kubernetes | 选修 6–8h：本地 kind 部署一次性同步 Job，观察 Pod 失败和重启，实验后关闭 | 目标岗位/工作实际要求，或已经完成主线 |
| Kafka / Streaming | 选修 6–8h：Docker 中用同一批比赛事件演示两个 consumer group、offset、回放、乱序 | 能说明 SQS 与日志流的差异，确实想学习多消费者/回放 |
| n8n | 用现有导出 workflow 画状态机和失败路径；需要时本地运行一次 | 不恢复 Lightsail，不把它列为完成 AI 的前置课程 |
| 向量数据库 | 直接用已有 Postgres/pgvector | R3 比较后再决定是否上线 |
| 多 Agent | 只加一个确实有独立职责的 agent 做对照 | 单 Agent 有明确不能解决的样例，且提升可测量 |
| 微调/模型训练 | 先积累失败样例与标注，理解训练/验证/时间泄漏 | prompt/检索/工具改进仍不能达到目标，且有足够高质量数据 |
| iOS 端侧 / ROS2 | 独立第二年方向 | 不放进 NBA 必做范围，不同时选两条 |

Postgres Realtime 通知、SSE 的 token 流式显示和 Kafka 数据流是不同概念；做完前两者不能声称已经掌握 streaming data engineering。Docker Compose 也不等于 Kubernetes，但可先学共享的健康检查、配置和任务生命周期。

## 7. 学习者与 AI 的分工

每阶段都由学习者亲自完成：一个明确验收标准、一段关键机制的改动、一次失败定位、一段不看稿的解释。AI 可生成页面、adapter、测试脚手架、图和文档，但不能替学习者决定“已经掌握”。

建议给 AI 的任务模板：

```text
当前学习阶段：R__。
我要掌握的机制：____。
请先基于现有文件解释输入、输出和失败路径，再给两个最小实现方案。
我会亲自实现/修改：____。
验收不变量：____；反例：____。
预算和运行边界：本地优先；线上使用免费配额；不新增常驻服务。
完成后用测试结果解释行为，不把生成代码或 build 通过等同于业务正确。
```

保留一份简短实验记录：问题、baseline、改变的一个变量、数据/版本、结果、失败样例、成本、取舍。该记录放项目文档，跨项目通用理解提炼到 RobotLife；不建立新的每日任务管理系统。

## 8. 第一轮开始做什么

前 12 小时只执行 R0：确认测试环境和已有改动 → 跑通一场 fixture → 画数据/身份路径 → 写一个重放或越权失败测试 → 理解并修复对应路径 → 解释验证结果。由同一条链路扩展到 R1。

优先级：身份/RLS 与测试 credit → 幂等同步和每日好友榜 → 单次 LLM 与 eval → 检索比较 → Agent/MCP → 多模态 → AWS 实验。若当前只能投入 2 小时/周，前四个月聚焦 R0/R1，并把第一版 AI 缩到一个已有接口的解释和评估。

这一顺序提供持续可展示的成果，又能让每增加一个组件都有明确的学习证据。最终作品集应列出“已实现、已测试、仅实验、计划中”四种状态，而不是用技术栈列表代替能力证明。

## 9. 验收后的作品集材料

- 需求与架构：一页说明用户任务、数据路径、身份边界、为何选免费托管。
- 可靠性：重放/恢复演示与真实好友结算。
- AI 质量：固定留出集、baseline 对照、错误例子和费用。
- Agent：工具 schema、一次 MCP 调用、审批恢复与拒绝路径。
- 多模态：准确提取与失败时请人确认的例子。
- 云：Terraform plan、少量 AWS 事件执行及清理证明。
- 沟通：中文设计稿和 5 分钟日语/英语技术说明，说明限制与取舍。

以上全部是完成各阶段后应生成的证据，本次只交付两份学习材料，不把计划中的实现计为已完成。
