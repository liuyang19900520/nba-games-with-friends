# NBA 项目：本地与生产两环境设计

更新：2026-09-13。目标是个人展示、学习优先、尽量无固定基础设施费用；本次不创建第二套收费资源。

## 1. 结论

使用 **一个 Next.js 项目 + 一个 Supabase Free 项目**，运行在两个位置：

- 本地：localhost:3000，页面、Server Actions、AI API 和测试支付都由 npm run dev 启动。
- 生产：Vercel 的 main 分支部署；使用同一套代码，不再单独部署前端依赖的 AI Lambda 或支付 Lambda。

“不需要两套数据库”不等于“所有数据都可以混用”。公开体育数据共享；余额、调用记录、测试充值必须逻辑隔离。共享项目节省资源，也意味着数据库结构变更、Auth 配置、配额和故障仍然是共享的。

## 2. 资源划分

| 项目 | 本地 | 生产 | 隔离方式 / 注意事项 |
|---|---|---|---|
| Next.js 页面与 API | npm run dev | Vercel 按请求运行 | 同代码、同源 /api，两个运行实例 |
| NBA 球队 / 球员 / 赛程 / 统计 | 读取已同步数据 | 读取同一批数据 | 共用，不复制上游采集任务 |
| Supabase Auth | 建议专用测试账号 | 展示账号 | 同一个用户目录；注册、改密码、删除账号都是真实共享操作 |
| v2 credit 钱包 | environment=local | environment=production | 复合主键；不能互相扣费或充值 |
| AI 请求 / 结果 | local 分区 | production 分区 | 幂等键绑定环境、用户及请求；服务端选环境 |
| 测试充值记录 | local 分区 | production 分区 | 回调校验 session 的环境，不接受另一环境的充值 |
| 旧阵容 / 比赛 / 排行榜 | 默认禁止本地阵容提交 | 仍走既有表 | 旧表尚未隔离；只给专用测试账号开放 LOCAL_TEST_USER_IDS |
| 模型 | 默认 demo，不请求模型 | 默认 demo，可主动改 llm | 共享模型账号也可以；调用额度不是隔离账户或金额硬上限 |
| 支付 | 默认站内 demo，可选 Stripe Test | 同样仅 demo / Stripe Test | 本项目展示，不接真实收款 |
| 通知 | 默认关闭 | 默认关闭，可选开启 | 不要求配置 OneSignal 才能运行 |

环境取值由服务器判断：只有 VERCEL_ENV=production 才使用 production 分区，其余使用 local。因此本机 next build / next start 虽然 NODE_ENV=production，也不会误操作生产钱包。不要手动把本地 VERCEL_ENV 设置为 production。当前不启用第三个 Preview 环境。

这不是数据库层面的物理安全边界：service role 对共享项目权限很高。需要测试破坏性 migration、RLS 或旧业务写入时，应改用本机 Supabase / 临时隔离数据库，不能拿共享项目做清库实验。

## 3. 本地最少配置与操作

现有本地环境文件已保留，没有输出或覆盖其中的密钥。新机器可复制 apps/web/.env.example 到 apps/web/.env.development.local，填写：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
AI_MODE=demo
PAYMENT_MODE=demo
```

URL 和 anon key 可以进入浏览器，但安全性依赖 RLS。service role、模型 key、Stripe key 和 webhook secret 只能保留在服务端。不要给后者加 NEXT_PUBLIC_ 前缀，不要提交任何真实 .env 文件。

```bash
cd apps/web
npm ci
npm run dev
```

打开 http://localhost:3000/home。使用 localhost 登录并始终保持同一主机名，避免和 127.0.0.1 的 cookies 混用。已登录后可进入 /payment，领取测试 credit；demo 也扣 credit，以便学习完整计费状态流程，但不会调用收费模型。

**当前一次性前置条件：新版 SQL 已编写并通过内存数据库测试，但尚未执行到托管 Supabase。** 需要在该项目的 SQL Editor 中执行 apps/web/supabase/migrations/202609130001_unified_web.sql，之后才能端到端体验新版领取 credit 与 AI 分析。未执行时首页可浏览，涉及新 RPC 的功能会返回不可用，不会悄悄降级写入旧余额。

本地专用账号需要提交阵容时，在本地服务端设置 LOCAL_TEST_USER_IDS=该账号UUID，然后重启。不要填真实展示用户。历史与未来日期仅供预览；提交仍限定东京时间当天。旧排行榜可能显示这个测试账号，因此这不是完整的旧业务隔离。

首页 Refresh 是“重新加载数据库中的赛程”，不是调用 NBA 上游刷新任务。休赛期当天没有比赛时应看到空状态；可以选择已有比赛的历史日期浏览。按需采集与 15 分钟缓存的管理入口是下一阶段，不应把现有按钮说成已经完成采集。

## 4. 一套登录服务如何支持两个网址

在 Supabase Authentication → URL Configuration：

1. Site URL 设置为正式生产域名。
2. Redirect URLs 加入 http://localhost:3000/auth/callback 和 https://你的生产域名/auth/callback；若使用 next 查询参数，还应按官方通配规则允许该 callback 的查询参数变体（如本地 callback?**），不要放宽到任意外部网站。
3. 如果选择使用 127.0.0.1，另加对应 callback，但日常建议只使用 localhost。

Google OAuth 使用 Supabase 时，Google Console 中的 provider 回调仍是同一个 Supabase /auth/v1/callback，不需要为每台本机各建一个 Google 应用。应用 callback 的 next 参数已限制为站内路径，不能跳转到外部站点。实际 Google/Supabase 后台配置本次未变更，需要登录联调验证。

最低配置建议使用现成的 Google / 邮箱登录。短信登录需要单独的短信供应商，可能收费，不属于“默认免费可运行”的依赖。

参考：[Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)。

## 5. 充值回调不需要“两套收款系统”

### 默认：站内 demo

无需 Stripe、webhook 或公网隧道。登录后进入 /payment/demo，余额为零时每日可领 5 个测试 credit。额度按用户、环境和 UTC 日期限制；每日不是每次刷新。请求失败不重复扣 credit，成功结果支持同一请求幂等重放。

### 可选：Stripe Test Mode

同一 Stripe 测试账户和测试 Price 可以共用，固定一次 checkout 发放 5 credit；前端不能指定充值用户、金额或 credit 数量。

生产使用固定公开端点：

```text
https://你的生产域名/api/payment/webhook
```

本地使用 Stripe CLI 转发到本机（只在需要联调 Stripe 时启动）：

```bash
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded --forward-to localhost:3000/api/payment/webhook
```

- 两边分别设置 PAYMENT_MODE=stripe_test、STRIPE_SECRET_KEY 和 STRIPE_CREDITS_PRICE_ID。
- **本地 STRIPE_WEBHOOK_SECRET 用 CLI 输出的 whsec；生产用 Dashboard 对应端点的 whsec。不能混用。**
- 服务端创建的 session metadata 带 purpose、environment、price_id 和固定 credit 数量。回调验签、确认 test mode 且已支付、校验这些字段之后，原子入账。
- 生产端点收到 local session 会忽略；本地收到 production session 也忽略。因此即使 Stripe 将同一事件送给多个端点，也不会串账。
- 每个 session 只能入账一次。数据库暂时不可用时回调失败，交给 Stripe 重试；跳到 /payment/success 不代表付款成功，页面只认数据库已确认的到账记录。
- 不要把 v2 webhook 直接覆盖 v1 在用端点。新旧应用过渡期间按 purpose 区分；旧事件仍需旧处理器。确认不再存在在途 v1 session 后再停旧端点。

代码拒绝 live key / live event。本次未创建 Stripe 端点、Price，也未调用 Stripe 创建真实或测试 checkout。

参考：[Stripe Webhooks](https://docs.stripe.com/webhooks)。

## 6. 从本地到生产

```text
本地开发 / 浏览
    ↓ npm test + npm run typecheck + npm run build
commit → push 功能分支 → PR 到 main
    ↓ GitHub Actions 测试 / 类型检查 / 构建通过
merge main → Vercel 再测试 / 构建 → 自动发布
```

仓库配置已整理：

- .github/workflows/ci.yml：Web 测试、类型检查、构建。测试不需要生产 secrets，不连接生产数据库。
- apps/web/vercel.json：仅 main 自动部署，其他分支不自动生成 Preview；部署前也运行测试。
- 删除旧 auto-pr-to-dev.yml，避免每次功能分支 push 强制生成指向 dev 的 PR。若喜欢 dev 分支仍可用于开发，但不是第二套云环境。
- 不使用 GitHub Actions SSH 上服务器，不需要 EC2、EIP 或前端 Docker 部署。

**托管平台上仍需一次性设置，本次没有替你修改账户或发布：**

1. Vercel 导入这个仓库，Root Directory=apps/web，Production Branch=main，Node.js=22.x。
2. Production 环境设置上述 3 个 Supabase 变量及两个 demo 模式变量；不把 service role 分配给不受信任的 Preview。
3. 在 GitHub 仓库规则允许的情况下，main 必须通过 “Test, typecheck and build” 状态检查后才能合并。workflow 文件本身不能阻止管理员绕过合并；若没有保护规则，需要手动坚持此门槛。
4. Supabase 执行新增 migration，配置 Auth 的两个回调地址；如启用 Stripe Test 再配置 webhook。
5. 首次上线验证登录、测试 credit、AI demo、隔离钱包、重复回调以及旧业务，再将展示地址切换过去。

[Git 部署控制](https://vercel.com/docs/project-configuration/git-configuration)只控制是否构建分支，不能替代 Vercel Production Branch 和 GitHub 分支保护设置。

数据库 schema 不应该在每次 npm build 时自动修改。当前只新增 v2 表 / 函数，可以先 migration 后代码上线；不修改旧 users 余额与既有 RPC。后续采用“先新增、代码兼容、迁移数据、最后移除旧字段”的顺序。共享库禁止自动 reset。回滚应用不自动回滚数据库；v1.0.0 是旧代码参考点，不代表部署或数据的完整备份。

## 7. AI、credit 与费用边界

- demo：数据库事实 + 确定性规则，不冒充模型推理，不输出伪造的准确率。
- llm：仅在 AI_MODE=llm 时启用，固定一次模型请求，关闭额外 thinking，输出结构校验、25 秒模型超时、45 秒任务预算、输出上限 700 tokens；无搜索工具、无自动多代理循环。显式关闭 thinking 是因为供应商当前默认开启，见 [DeepSeek Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)。
- AI 请求预占 1 credit，成功保存结果后结算；失败退款。相同请求不会再次调用模型；异常中断的预占在到期后下一次钱包访问时回收，无需收费定时任务。
- 当前代码限制 demo 每用户每环境每日最多 20 次；llm 每用户每环境每日最多 2 次，共享数据库所有环境累计最多 10 次。失败尝试也计入调用次数限额。
- 这些是应用层次数控制，不是供应商金额硬上限。LLM 账号、第三方代理、短信或其他应用产生的费用不由这些计数完全约束。真正开启 LLM 前，应在供应商侧设置预算 / 余额限制并核对当前价格。

Vercel Hobby 适合本项目的个人非商业用途，但有资源上限；Supabase Free 有容量、流量和不活跃暂停限制。目标是**默认无固定主机费用，在免费额度内运行**，不是承诺任何流量都零费用，更不是默认真模型免费。已有云资源不会因代码改造自动停止计费，本次没有删除任何 AWS 资源。

参考：[Vercel Hobby](https://vercel.com/docs/plans/hobby)、[Supabase Free 项目暂停](https://supabase.com/docs/guides/platform/free-project-pausing)。

## 8. 这一阶段完成了什么，还没完成什么

代码已覆盖同源 AI / 支付入口、共享流式处理、服务端环境分区、原子 credit、测试支付与回归测试；托管 migration、真实 OAuth / Stripe / LLM 联调及自动生产部署尚未执行。

生产发布之前，仍需处理旧版 users / 余额 RPC 权限问题和历史配置泄露、验证旧业务 RLS、阵容提交原子性与比赛锁定。新增的 v2 表采用 RLS + 仅 service role 可调用事务函数，不代表旧表的安全问题已被修复。

本地与生产仍共用体育数据、Auth、数据库管理权限和配额。如果以后升级为多人真实业务或真实收款，应增加真正独立的测试数据库和支付沙盒，并再评估备份、恢复、审计、限流及持续数据保留策略。
