# v2 迁出 + 前端数据 vs ESPN 缺口（2026-10-28 JST）

## A. v2 迁出（已完成）
- `dev` tip = `96441c3ffdd02359cef4651298e253676e7d834e`
- 标签 `legacy-v1`（轻量）→ 同 SHA：https://github.com/liuyang19900520/nba-games-with-friends/tree/legacy-v1
- 分支 `v2` → 同 SHA，无新提交：https://github.com/liuyang19900520/nba-games-with-friends/tree/v2
- 默认分支、PR、secrets 都没动

## B. ESPN 缺什么（只列部分/缺失）
| 前端用到的值 | ESPN | 解决办法 |
|---|---|---|
| 幻想分 fantasyScore / fantasy_avg / 阵容 total_score | 缺 | 用 box score 按 fantasy-scoring.json 自己算，落到 game_player_stats，再汇总 |
| 球队页 近5场幻想分 fantasyScores[] | 缺（现在代码里是 `[]`） | 取每个球员最近5场 box 自己算 |
| 球员页 近期比赛 recentGames（含 fantasy） | 部分 | gamelog / box 有 min-pts-reb-ast-stl-blk-tov；fantasy 自算（现在代码里是 `[]`） |
| 分节比分 quarters q1–q4 | 有，但前端只写死了4节（现在是 mock） | 用 linescores；表存 jsonb/game_periods，前端要支持 OT |
| 比分走势 scoreTrend（现在 mock） | 部分 | 用 summary.plays[] 的 clock/period/awayScore/homeScore 自己生成（按每分钟或每次得分取点） |
| 球员关键时刻 clutchTimeStats + 联盟均值/百分位（现在写死0） | 缺 | 用 plays 筛出第4节/OT 最后5分钟且分差≤5 的回合自己算；工作量大，v2 建议先删 |
| 雷达图 leagueComparison 5项 + 联盟均值（现在写死50） | 缺 | 用 byathlete 全联盟场均算百分位（得分/助攻/篮板/抢断+封盖/TS%） |
| radarStats、defRating | 缺 | radar 同上；defRating 是高阶数据，ESPN 没有 → 删 |
| 投篮图 player_shots（区、距离） | 部分 | plays.coordinate 有坐标和命中；区域/距离自己算，坐标要换算 |
| 球员上场时间 "32:45" | 部分 | ESPN 只有整数分钟 → 显示 "32" |
| 位置 PG/SG/SF/PF/C | 部分 | ESPN 给 G/F/C 粗粒度；改前端用 G/F/C，或手工补 |
| 排名 conf_rank/home/road/streak | 有（standings 接口） | 球队缩写/ID 照映射表转换 |
| 赛区 division、primary_color | 部分 | 颜色 /teams 有 `color`（未实测）；赛区静态30行 |
| 头像/队标 | 有（实测200） | `a.espncdn.com/i/headshots/nba/players/full/{id}.png`、`.../teamlogos/nba/500/{abbr}.png`；部分新秀可能没头像 → 占位图 |
| 中文名 | 缺 | 球队30行手填；球员一次性人工 crosswalk，存 name_zh |
| 比赛评分数 ratingCount | 缺（虎扑 UGC） | 删，或用我们自己的好友评分 |
| 好友排行榜（现在 MOCK_LEADERBOARD）、阵容、积分、订阅/credits、isFollowed | 不归 ESPN | 我们自己的表：user_daily_lineups / lineup_items / users + 新加 follows；排行榜从 lineup total_score 汇总 |
| AI 预测（winner/confidence/key_factors/分析）、AI 阵容 | 不归 ESPN | LLM 自己生成；输入用 ESPN 战绩、近5场、伤病（/injuries）、我们的 fantasy 均值 |

**完全覆盖**：赛程/日期/开赛时间/状态/比分/球馆、对阵球队名/缩写/战绩、box score（pts/reb/ast/stl/blk/tov/FG/3PT/FT/+-/首发）、球员资料（号码/身高体重/队伍）、赛季场均与命中率、球队场均（ppg/rpg/apg/stl/blk/tov）、阵容名单、排名胜负胜率连胜、伤病。
注意：ID 要 crosswalk（或直接改用 ESPN id），球队缩写 GS/NO/NY/SA/UTAH/WSH 要转换。

## C. 虎扑 vs ESPN 不同
1. 虎扑有中文名/中文新闻，ESPN 全是英文（lang=zh 也无效）。
2. 虎扑有赛前首发消息，ESPN 开赛后才有 starter。
3. 虎扑有比赛耗时，ESPN 没有（可从 plays 时间推）。
4. 虎扑有用户评分、论坛热帖（UGC），ESPN 没有，也不该抓。
5. 虎扑球员表时间有秒，ESPN 只到整数分钟。
6. 虎扑有排名规则说明、球队官网/中文简介，ESPN 没有。
7. ESPN 有投篮坐标、单场日志 gamelog、前/后场篮板分列，虎扑没有。
8. ESPN 有伤病状态+回归日期、赛前预测/盘口、近5场，虎扑只有新闻式快讯。
9. ESPN 是公开 JSON 接口（非官方、无 SLA）；虎扑没有接口且禁止爬虫。
