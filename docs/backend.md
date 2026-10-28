# nba-web (v2) — Serverless API + static web

**完全 serverless，无常驻进程**：API 仅为无状态 AWS Lambda（Function URL，无 API Gateway），前端为纯静态文件（S3 + CloudFront，或 Vercel 静态托管），ESPN 同步仅由 EventBridge Scheduler 定时触发 Lambda（备选：GitHub Actions cron / Supabase pg_cron）。没有自定义服务器、没有长连接、没有内存状态；每个容器最多 1 个 DB 连接（复用于 warm 调用），经 Supabase **transaction pooler**（6543 端口）访问，连接/语句超时 3s/5s。`local/` 里的 runner 和 PGlite 只用于本地测试。

## 结构
| 路径 | 作用 |
|---|---|
| `api/handlers.ts` | 框架无关的 `route(req) => res`（全部业务逻辑，契约见 `/workspace/work/nba-mvp/API-CONTRACT.md`） |
| `api/i18n.ts` | 中文标签：统计项、榜单分类、赛季类型、伤病状态、比赛状态（球队/位置中文在 DB 表 `team_i18n`/`position_i18n`） |
| `api/lambda.ts` | AWS Lambda 适配器（Function URL / HTTP API payload 2.0，也兼容 REST 1.0）。腾讯云 SCF/其他云同理写 10 行适配器 |
| `api/db.ts` | `pg` Pool（handler 外创建，max=1，短超时），`DATABASE_URL` |
| `sync/lambda.ts` | 同步 Lambda：调用 `nba-sync/src/sync.ts` 导出的 `run(args)` |
| `scripts/export-snapshot.ts` | 静态 JSON 快照：同一 handler 输出写成文件（上传腾讯 COS/CloudBase/CDN） |
| `tests/curl-test.sh` | 对本地 runner 的每个端点做 curl + jq 断言 |
| `infra/template.yaml` | AWS SAM 模板（ap-northeast-1） |
| `local/server.ts` | 本地 runner（固定端口 8787，CORS，另在 `/snapshot/` 下提供快照文件） |
旧的 `web/` 静态页已由 Taro 应用（`/workspace/work/nba-mvp/app`）取代，移到 `/workspace/work/_archive_migrations_v2a/nba-web/web-v1-static`。

## API（`/api/v1`，GET，JSON，CORS `*`）
`/health` `/meta` `/teams` `/teams/:id` `/standings` `/players` `/players/:id` `/players/:id/gamelog` `/leaders` `/games` `/games/:id` `/games/:id/plays` `/injuries` `/stats/players`(旧别名)。
参数、示例响应、中文/英文约定、快照路径规则：见 `nba-mvp/API-CONTRACT.md`。缓存：已结束/参考数据 `s-maxage=3600`，排名/名单 `s-maxage=300`，当天/进行中 `s-maxage=30`。

## 本地运行
```bash
cd /workspace/work/nba-sync
npx tsx src/pglite-server.ts &                                     # PGlite :5433（.pgdata）
export DATABASE_URL=postgres://postgres@127.0.0.1:5433/postgres
npx tsx src/load-schema.ts local-shim.sql ../migrations/*.sql      # 仅新库
npx tsx src/sync.ts --full                                         # 整季回填（约 30 分钟，见 RUN-LOG）
cd ../nba-web && npx tsx local/server.ts &                         # http://127.0.0.1:8787/api/v1
tests/curl-test.sh                                                 # 全端点测试
npx tsx scripts/export-snapshot.ts --out=snapshot                  # 静态 JSON
```
注意：PGlite socket 同一时间只接受 1 个连接 → 同步运行时 API 连不上；生产 Postgres 无此限制。

## 腾讯云 / 大陆访问方案
1. **代理**：腾讯云函数（SCF/云函数）把 `/api/v1/*` 原样转发到海外 API（CloudFront 域名），带回 `cache-control`。
2. **静态快照**（代理不可用时）：`export-snapshot.ts` 生成 `snapshot/api/v1/...json`（路径规则见 `snapshot/index.json`），用 `coscmd`/CloudBase CLI 上传到 COS 或 CloudBase 静态托管；每天/每 10 分钟由能访问 ESPN 的机器（GitHub Actions / 海外 Lambda）重新导出上传。前端 `API_MODE=snapshot` 时按同一规则拼路径。

## 部署（需 Yang 批准后执行；本仓库未创建任何云资源）
1. **Supabase**：新建项目（推荐 Tokyo `ap-northeast-1`，与 Lambda 同区），执行 `/workspace/work/migrations/*.sql`。取 **Transaction pooler** 连接串（`...pooler.supabase.com:6543/postgres?sslmode=require`）。
2. **AWS SSM**：`aws ssm put-parameter --region ap-northeast-1 --name /nba/prod/database_url --type String --value '<pooler url>'`（标准参数免费；如需 SecureString，改为冷启动时用 SDK 读取）。
3. **构建 + 部署**：`npm run build && cd infra && sam deploy --guided --region ap-northeast-1 --stack-name nba-v2`
4. **前端**：`aws s3 sync web/ s3://<WebBucketName>/ --delete`，必要时 `aws cloudfront create-invalidation --distribution-id <id> --paths '/index.html' '/app.js'`。站点地址为输出 `SiteUrl`（`/api/*` 同域转发到 Lambda，`web/config.js` 保持空即可）。
   - 备选 Vercel 静态：把 `web/` 作为静态目录部署，在 `config.js` 填 CloudFront API 地址。
5. 环境变量只有一个：`DATABASE_URL`（Lambda 两个函数共用）。

## 成本估算（非商用、小流量 ≈ $0/月）
- Lambda：永久免费额度每月 100 万次请求 + 40 万 GB-秒。API 256MB、~50ms：CloudFront 缓存后回源极少；Sync 512MB、每 10 分钟（约 9 小时/天）≈ 1,600 次/月 × ~30s ≈ 2.4 万 GB-s，远低于额度。
- Function URL：无额外费用（只计 Lambda 调用），不使用 API Gateway。
- EventBridge Scheduler：每月 1,400 万次调用免费。
- CloudFront：永久免费每月 1 TB 流出 + 1,000 万次 HTTP/HTTPS 请求 + 200 万次 CloudFront Functions。
- S3：静态文件几十 KB，可忽略。SSM 标准参数免费。
- Supabase Free 计划（注意：免费项目长时间无活动会被暂停）；数据库是唯一的非 AWS 依赖。

## 中国大陆访问说明
Vercel 官方文档说明：Vercel 在中国大陆没有服务器或 CDN 节点，`.vercel.app` 子域可能被防火长城阻断或限速，且封锁按域名生效、可能随时变化、因运营商而异；建议使用自定义域名、自托管字体等资源，可靠访问需境内部署并取得 ICP 备案（https://vercel.com/kb/guide/accessing-vercel-hosted-sites-from-mainland-china）。GreatFire 的测试（截至 2026-10-28）显示 `vercel.app` 在大陆“基本被封”（DNS 污染、丢包）。`*.supabase.co` 与 `*.cloudfront.net` 的大陆可达性未在此验证；本架构中浏览器/小程序只访问 CloudFront 域名（DB 只由 Lambda 访问），建议绑定自定义域名并从大陆网络实测。微信小程序上线需在后台配置合法的 HTTPS request 域名。
