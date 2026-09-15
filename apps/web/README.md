# NBA Fantasy — Unified Web

一个 Next.js 应用承载页面、登录、AI 分析与测试充值。不需要本地启动 Lambda、Python AI 服务、n8n 或 Docker。

## 本地启动

需要 Node.js 22+。在 apps/web 目录执行：

```bash
npm ci
cp .env.example .env.development.local
npm run dev
```

已有本地环境文件时不要覆盖；Next.js 的 .env.local 优先于 .env.development，请避免同名变量配置冲突。只需填写 Supabase URL、public anon key、server-only service role key。访问 http://localhost:3000/home。

AI_MODE=demo、PAYMENT_MODE=demo 是默认值：不调用模型、不发起真实支付。要测试完整 credit 流程，需要先在现有 Supabase 项目执行 supabase/migrations/202609130001_unified_web.sql。它新增独立的 v2 表与函数，不迁移或覆盖 v1 余额。

## 验证

```bash
npm test
npm run typecheck
npm run build
```

本地开发服务器运行时，可用 NBA_BUILD_DIR=.next-verify npm run build 隔离构建目录。测试使用内存 PostgreSQL 和模拟外部 API，不需要生产密钥，不产生模型或支付费用。

## 部署

推荐个人非商业展示使用 Vercel Hobby + Supabase Free。Vercel 的 Root Directory 设为 apps/web，Production Branch 设为 main，Node.js 设为 22.x。只给 Production 配置服务端密钥。仓库中的 vercel.json 禁用其他分支的自动预览部署；合并 main 后由 Vercel 测试、构建和发布。

详细的共享数据库、OAuth、Stripe 回调、上线前一次性设置与限制，见 [本地与生产环境设计](../../docs/local-production-environments.zh-CN.md)。

## 代码入口

- src/app/api/predict、api/lineup/generate：同源 AI 接口；共享验证、流式响应、幂等扣 credit。
- src/lib/ai：数据库证据、确定性 demo、可选的一次模型调用。
- src/app/api/payment：测试 checkout 与验签 webhook；不接受 live 支付。
- src/app/payment/demo：不经过 Stripe 的测试 credit 领取页。
- src/lib/server：身份验证、环境选择与数据库 RPC 边界。
- supabase/migrations：新 credit 钱包、调用记录、充值记录及原子事务。
- tests：API、SSE 与 SQL 回归测试。

## 当前边界

这是一阶段的应用整合，不是所有旧业务的完全重写。赛程来自已同步数据库，首页 Refresh 只重读数据库，不触发 NBA 上游采集。默认分析不是 LLM，页面明确标注 Data demo；真实 LLM 模式也不包含实时伤病检索。历史赛季均值可能包含当时尚未发生的比赛，不能将历史预览当成无泄漏回测。

旧版阵容表尚未按环境拆分，本地提交默认禁止；只有显式配置的专用测试账号可提交当天阵容。共享 Auth 的注册、改密码等仍影响同一个账号系统。v1 余额权限、旧版阵容原子提交/比赛锁定等遗留问题需在正式上线前单独处理，不能因为新增 v2 钱包就认为旧版安全问题已消失。
