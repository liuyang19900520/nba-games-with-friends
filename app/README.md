# NBA MVP — Taro 4 前端（微信小程序 + H5 一套代码）

纯 ESPN 数据浏览（无积分/fantasy）。视觉沿用 v1（`legacy-v1` tag 的 `apps/web`：深海军蓝 `#0D121D` 底、青色 `#6EE2F5` 主色、橙色 `#F5A623` 强调、半透明卡片 + 青色描边、Inter 字体、比赛卡片“队徽-比分-状态线-比分-队徽”布局），信息结构参考虎扑 App（球员榜左侧分类、球队/球员页队色头部 + Tab、“联盟第N”红标签）。

## 技术选型（为什么）
- **Taro 4 + React + TS**：一套代码编译到微信小程序（weapp）与 H5；React 生态/TS 与 v1 一致，后续 iOS/Android 用 H5 壳（或 Taro RN）复用。
- **无 UI 库、无状态库**：只用 Taro 内置组件（View/Text/Image/ScrollView/Picker），Less 变量即设计 token（`src/theme.less`），主包小（~0.4MB）。
- **薄 API 客户端**（`src/lib/api.ts`）：内存 + Storage 缓存，`request`/`cloud` 两种传输模式；表格按接口返回的数值字段**自动生成列**（ESPN 新字段无需改代码即可显示，“越多越好”）。

## 假数据模式（当前默认，`TARO_APP_API_MODE=mock`）
- 不需要任何后端：所有页面读 `static/mock/**.json`（随 H5 一起发布在 `/mock/...`，**按路径懒加载**，每个接口一个文件；路径规则与后端 `scripts/export-snapshot.ts` 一致：`/api/v1/<path>?a=1&b=2 → mock/api/v1/<path>/a/1/b/2.json`）。
- 生成：本地后端跑起来后 `node scripts/build-fixtures.mjs http://127.0.0.1:8787`（30 队、东西部排名、伤病、meta、每个榜单类别前 30、6 支球队完整页、28 名球员完整详情、14 场比赛详情（PBP 裁剪到 160 条、胜率曲线采样 100 点））→ 约 1.6MB JSON。
- 图片：`python3 scripts/localize-images.py` 下载 30 个队徽 + fixtures 中出现的球员头像，缩放后存到 `static/img/teams|players/`，并把 fixtures 里的 URL 改写为 `/img/...`。**图片版权属 ESPN，仅限非商业 MVP 使用。**
- 小程序 + mock：主包 2MB 限制，fixtures/头像**不打进小程序包**（`config/index.js` 里 `copy` 仅对 H5 生效）；小程序在 mock 模式下从已部署的 H5 站点取 `https://nba-v2.vercel.app/mock/...` 和 `/img/...`（`TARO_APP_STATIC_BASE` 可改）。开发者工具里需勾选“不校验合法域名”；正式版需把该域名配为 request/downloadFile 合法域名（大陆需 ICP 备案域名）。
- 正式建议：小程序只打包 30 个队徽（约 340KB，可选），头像走远程（自有已备案域名/COS/CDN）。
- 切到真实 API：`npx taro build --type h5 --mode api`（读取 `.env.api`）。

## 运行
```bash
npm i
# 后端（另一 worker 维护）：见 /workspace/work/nba-web/README.md → http://localhost:8787
npm run dev:h5        # 或 npx taro build --type h5 --watch，然后静态服务 dist/h5
npm run build:h5      # → dist/h5（静态文件）
npm run build:weapp   # → dist/weapp（用微信开发者工具打开项目根目录，project.config.json 已指向 dist/weapp）
node scripts/screens.mjs http://127.0.0.1:8090/#   # Playwright 390x844 截图 → ../screens/
```
配置（`.env.development` / `.env.production`，Taro 自动注入 `TARO_APP_*`）：
| 变量 | 说明 |
|---|---|
| `TARO_APP_API_BASE` | API 根地址，如 `https://api.example.com`（本地 `http://localhost:8787`） |
| `TARO_APP_API_MODE` | `request`（Taro.request 直连）或 `cloud`（小程序 `wx.cloud.callFunction('api')` 代理） |
| `TARO_APP_CLOUD_ENV` | cloud 模式的云开发环境 ID |

## 页面
| 页面 | 路径 | 内容 |
|---|---|---|
| 赛程（Tab） | `pages/index` | 日期横滑 + 前后切换；比赛卡片（队徽、中文队名、比分、状态/本地时间、战绩、场馆/转播） |
| 球队榜（Tab） | `pages/standings` | 东/西部；排名、胜负、胜率、胜场差、主/客、分区/赛区、近10、连胜、得失分、种子（横滑表格） |
| 球员榜（Tab） | `pages/leaders` | 左侧分类竖栏、基础/进阶、赛季+赛季类型下拉、每类前5 + 查看全部 |
| 完整榜单 | `pages/leaderlist` | 单项完整排名 |
| 数据（Tab） | `pages/more` | 30 队入口、伤病报告、中/英切换 |
| 球队页 | `pages/team` | 队色头部（队徽/名/球馆/排名/总·主·客胜负）；球员(名单+场均+薪资)、赛程、数据(含联盟排名)、薪资、资料(球馆/教练/战绩拆分) |
| 球员页 | `pages/player` | 队色头部（头像/位置号码/年龄/身高/体重/伤病）；数据(基础+进阶网格带“联盟第N”、季前/常规/季后、ESPN 原始分组、生涯表)、比赛(日志横滑)、资料 |
| 比赛详情 | `pages/game` | 比分头 + 节比分；数据(双方 box score、首发/替补/合计/DNP)、球队对比、过程(按节 PBP)、资料(场馆/观众/裁判/转播/赔率/伤病/胜率走势) |

## 语言
中文默认；“数据”页右上角切换 English（存 Storage）。**H5 海外版**：首次访问若浏览器语言非 `zh*` 则默认英文（`src/lib/i18n.ts detect()`）；小程序固定中文默认。队名中文优先用 API `name_zh`/`short_name_zh`，缺失时用本地表 `src/lib/teams.ts`；统计项名称优先用 `/meta` 的 `stat_labels`。

## 部署 H5
`npm run build:h5` 产物是纯静态（hash 路由，无需服务器重写）。
- **S3 + CloudFront**：`aws s3 sync dist/h5 s3://<bucket>/ --delete`；`index.html` 设短缓存，`js/ css/ chunk/` 长缓存；API 同域 `/api/*` 转发到 Lambda 时 `TARO_APP_API_BASE` 留空即可。
- **Vercel（已采用，项目 `nba-v2`）**：Root Directory = `app`，配置见 `vercel.json`（install `npm ci`，build `npx taro build --type h5`，输出 `dist/h5`；hash 路由无需 rewrites）。push 到 `v2` → 生产部署；其他分支/PR → 预览。注意 `vercel.app` 在中国大陆不可靠，仅海外版用。

## 提交微信小程序
1. 在 `project.config.json` 填真实 `appid`（现为 `touristappid` 占位），微信开发者工具导入本目录 → 预览/上传 → 公众平台提交审核。
2. **网络**：小程序只能请求后台配置的 HTTPS **合法 request 域名**，大陆主体通常需要 **ICP 备案域名**。两种方案（构建时选择）：
   - `TARO_APP_API_MODE=request`：`TARO_APP_API_BASE` 设为已备案域名（可 CNAME/反代到 CloudFront）。
   - `TARO_APP_API_MODE=cloud`：开通微信云开发，部署 `cloudfunctions/api`（转发到海外 API，设置环境变量 `API_ORIGIN`），小程序侧不需要 request 域名。
   - 另：后端提供 snapshot 静态 JSON 模式（可放腾讯云 COS），见 `../API-CONTRACT.md`；前端尚未实现 `snapshot` 模式（加一个 URL 映射函数即可）。
3. 主包限制 2MB：当前 `dist/weapp` 约 0.4MB（无分包）。图片（队徽/头像）走 ESPN CDN，需在后台配置 `downloadFile` 合法域名 `a.espncdn.com`（或经自有域名代理）。

## 目录
`src/lib/`（api / i18n / teams / stats 标签 / fmt / hooks / meta）、`src/components/`（ui：Loader/Tabs/Seg/Table/KV/Section；game 卡片；leader 行）、`src/pages/*`。
