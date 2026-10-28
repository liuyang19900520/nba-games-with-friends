# 虎扑 vs ESPN 字段对照（2026-10-28 JST 实测）


## 结论
- 58 个虎扑字段：能对上 39（含需推导），部分 11，对不上 4，不建议 3，ESPN 额外 1（单场日志）。按区块：比赛/box/文字直播/排名 ≈95%；榜单/球员/球队页 ≈80%；首页资讯 ≈40%（英文、无赛前首发）；中文名与 UGC 0%。
- 中文名：实测 `?lang=zh&region=cn` 对 scoreboard 与 athletes/1966 仍返回英文 "LeBron James"，ESPN 无中文名。
## 对不上清单与办法
1. 中文球员/球队名：球队 30 行手填；球员按 (英文名规范化, 球队, 生日) 与虎扑球员页标题 "中文名|English Name" 做一次性、低频人工 crosswalk（虎扑协议禁止爬虫，不批量抓 sitemap；或用维基百科中文条目，CC BY-SA 需署名）。
2. 赛前首发：ESPN 不提供 → 放弃或开赛后用 starter。
3. 比赛耗时：wallclock 首末推导（近似）。
4. 排名规则/官网/中文简介：静态手写。
5. 中文新闻/伤病文案：只存 ESPN 英文 status，前端用状态词中文映射。
6. 评分/论坛：不做。
## 对 v2 DB 的影响
- players/teams/games 加 `espn_id`（或 external_ids(entity, entity_id, source, ext_id) 表，source ∈ espn/nba/hupu），加 `name_zh`、`name_zh_source`、`name_zh_verified`。
- game_player_stats 加 oreb/dreb/starter/position/did_not_play；min 存整数分钟。
- games 加 attendance、venue、linescores(jsonb 或 game_periods 表，支持 OT)。
- 新增 game_plays(game_id, seq, period, clock, team_id, type_id, text, away_score, home_score, wallclock) ；injuries(player_id, status, short_comment, date, fetched_at)。
- raw_payloads(source, endpoint, key, fetched_at, json) 保留原始响应，便于字段变更回填。
## 时效/限流观察
- scoreboard 响应头 `cache-control: max-age=55`；单次请求 1–2.3s；约 25 次、≥1s 间隔未遇到限流。
- 有一次 scoreboard?dates=20261027 返回 200 但空 body，重试正常 → 需重试与 JSON 校验。
- 上座人数直播中可能为 0；终场后 box 完整度/延迟未测定。
## 未验证
- 加时 linescores 实例、季后赛/附加赛 seasontype、球员季后赛 stats 切分、整队球员数据单接口、teams schedule 80/82 差异、终场后 box 定稿延迟、ESPN 限流阈值。未访问虎扑页面（基线来自用户浏览）。

## 总表
| 虎扑区块/字段 | ESPN 接口与路径 | 状态 | 备注 |
|---|---|---|---|
| 首页·比赛条 比分/节次剩余时间 | scoreboard → events[].competitions[0].competitors[].score; status.type.shortDetail("7:51 - 3rd"), status.period, status.displayClock | 能对上 | 实测今日直播中 BOS-BKN 返回 7:51 - 3rd；max-age=55 缓存 |
| 首页·新闻 | /news?limit= → articles[].headline/published/links | 部分 | 英文 ESPN 稿件，非中文；只能放标题+外链 |
| 首页·伤病快讯(Shams 类) | /injuries → injuries[].injuries[].status/shortComment/longComment/date/athlete | 部分 | 有状态(Day-To-Day/Out)+英文说明+时间，是 Rotowire 式条目，非突发推文；/teams/{id}/injuries 返回 {}（不可用），按 team 过滤全量即可 |
| 首页·首发消息(赛前) | 赛前 summary 无 boxscore.players（实测 401909880 为空）；开赛后 athletes[].starter | 对不上(赛前) | 赛前官方首发 ESPN 不提供；开赛后可从 box starter 得到。可从 news 标题人工看，或放弃 |
| 首页·今日最佳 得分/篮板/助攻 top3 | 可由当日所有 summary boxscore 汇总；scoreboard competitors[].leaders 仅每队第一人 | 能对上(需推导) | 自算排序 |
| 首页·球员场均榜 top3 | core …/seasons/2027/types/2/leaders → categories[].leaders[] (displayValue, athlete.$ref) | 能对上 | athlete 为 $ref 需二次请求或用 byathlete |
| 首页·球队专区热帖 | — | 不建议 | UGC，ESPN 无，也不应采集虎扑论坛 |
| /games·7天日期条 | scoreboard?dates=YYYYMMDD（逐日） | 能对上 | 实测 dates=20261021-20261028 区间返回 400；需逐日请求或用 teams/{id}/schedule |
| /games·状态 进行中/未开始/已结束 | status.type.name STATUS_SCHEDULED/IN_PROGRESS/FINAL, state pre/in/post | 能对上 | 需映射成中文 |
| /games·分节比分含加时 | scoreboard competitors[].linescores[].value；summary header.competitions[0].competitors[].linescores[].displayValue | 能对上 | 加时=linescores 长度>4（本次样本无加时，OT 条目未实测） |
| /games·得分王/篮板王/助攻王 | scoreboard competitors[].leaders[name=points/rebounds/assists].leaders[0] | 能对上 | 另有 rating 综合项 |
| /games·当日效率排行(得分/篮板/助攻/抢断/封盖) | 由当日 boxscore 汇总 | 能对上(需推导) | 抢断/封盖 leaders 不在 scoreboard，必须自算 |
| /games·数据直播/前瞻/文字直播入口 | 赛前 summary: lastFiveGames, leaders, injuries, seasonseries, predictor, odds；赛中 plays | 部分 | 前瞻有数据无中文文章 |
| boxscore头部·胜负战绩 | summary header…competitors[].record[type=total/home/road].summary | 能对上 |  |
| boxscore头部·开赛时间 | events[].date / header.competitions[0].date (UTC, 无秒) | 能对上 | 转北京/东京时间自理 |
| boxscore头部·耗时 | 无 duration 字段；plays[0].wallclock→plays[-1].wallclock 可推（样本 21:11:46Z→23:36:50Z≈2h25m） | 部分(推导) | 近似值，含赛前跳球前时间不准 |
| boxscore头部·球馆 | summary gameInfo.venue.fullName；scoreboard competitions[0].venue.fullName | 能对上 |  |
| boxscore头部·上座人数 | summary gameInfo.attendance (17867)；scoreboard competitions[0].attendance | 能对上 | 比赛中可能为 0（实测 NY-DET 直播中 0），终场后再取 |
| 球员表·首发/替补 | boxscore.players[].statistics[0].athletes[].starter | 能对上 |  |
| 球员表·位置 | athletes[].athlete.position.abbreviation | 能对上 | ESPN 只给 F/G/C 粗粒度 |
| 球员表·时间 | stats[keys.index(minutes)] "30" | 部分 | 整数分钟，无秒 |
| 球员表·投篮/3分/罚球 命中-出手 | keys fieldGoalsMade-fieldGoalsAttempted 等 "3-9" | 能对上 | 拆分 M-A |
| 球员表·前场板/后场板/篮板 | offensiveRebounds / defensiveRebounds / rebounds | 能对上 |  |
| 球员表·助攻/犯规/抢断/失误/封盖/得分 | assists/fouls/steals/turnovers/blocks/points | 能对上 |  |
| 球员表·+/- | plusMinus "+11" | 能对上 | 去掉 + |
| 球队合计行 | boxscore.players[].statistics[0].totals | 能对上 | +/- 与 MIN 为空串 |
| 命中率行 | boxscore.teams[].statistics[name=fieldGoalPct/threePointFieldGoalPct/freeThrowPct] | 能对上 | 整数百分比("49")；另有快攻/内线/最大领先等 |
| 中文球员名/球队名 | — | 对不上 | 见中文名一节 |
| 文字实录·时间/球队/事件/比分 | summary plays[]: clock.displayValue, period.number, team.id, text, awayScore/homeScore | 能对上 | 样本 514 条；core …/competitions/{id}/plays 同样 514 条 |
| 文字实录·换人/犯规/暂停 | plays[].type.text: Substitution(61), Personal/Shooting/Loose Ball Foul, Full Timeout(9), Coach's Challenge | 能对上 | 英文描述，需按 type.id 模板翻译成中文；另有 coordinate 投篮坐标(虎扑没有) |
| /schedule·按日期 | scoreboard?dates=YYYYMMDD | 能对上 | 不支持区间 |
| /schedule·全赛季/按球队 | teams/{id}/schedule?season=2027 → events[] (实测 LAL 80 场 10-22~04-12) | 能对上 | 82 场中返回 80，原因未查 |
| /schedule·北京时间 | UTC 时间 | 部分(推导) | 客户端换时区 |
| /schedule·赛区/球队筛选 | teams 接口 groups / standings children | 能对上 | 需自建赛区映射 |
| 得分榜等 8 个榜 | common/v3/…/statistics/byathlete?sort=offensive.avgPoints:desc → athletes[].categories | 能对上 | general: gamesPlayed, avgMinutes, avgRebounds; offensive: avgPoints, avgFGM/FGA, fieldGoalPct, 3P/FT 同理, avgAssists; defensive: avgSteals, avgBlocks |
| 篮板榜·进攻/防守篮板 | byathlete general 只有 rebounds/avgRebounds；athletes/{id}/stats averages OR/DR | 部分 | 榜单需按球员 stats 汇总或从 box 自算 |
| /stats/teams 球队榜 | common/v3/…/statistics/byteam；core …/teams/{id}/statistics (含 rank) | 能对上 |  |
| standings·排名/队名/胜/负/胜率/胜场差 | standings?season=2027 children[东/西].standings.entries[].stats: playoffSeed, wins, losses, winPercent, gamesBehind | 能对上 |  |
| standings·主场/客场/赛区/东西部 | stats Home, Road, vs. Div., vs. Conf. | 能对上 |  |
| standings·得分/失分/净胜 | avgPointsFor, avgPointsAgainst, differential (pointsFor/Against 总计) | 能对上 |  |
| standings·连胜/负 | streak "L4" | 能对上 | 另有 Last Ten Games |
| standings·排名规则说明 | — | 对不上 | 静态文案自写 |
| 球员页·生日/出生地/选秀 | core /athletes/{id}: dateOfBirth, birthPlace{city,state,country}, draft{year,round,selection} | 能对上 | common/v3 athletes/{id} 只给 displayDraft、age，生日为空；用 core 或 roster |
| 球员页·国籍 | citizenship 为 null（LeBron 实测） | 部分 | 用 birthPlace.country 近似 |
| 球员页·身高体重/位置/号码 | displayHeight, displayWeight, position, jersey | 能对上 |  |
| 球员页·技术统计联盟排名 | —（athlete stats 无 rank 字段） | 部分(推导) | 由 byathlete 全量排序自算 |
| 球员页·本赛季与生涯 常规/季后 | common/v3 athletes/{id}/stats categories averages/totals（24 行逐季） | 部分 | 季后赛切分参数未实测 |
| 球员页·逐赛季表 | stats averages labels: GP, GS, MIN, FG, FG%, 3PT, 3P%, FT, FT%, OR, DR, REB, AST, BLK, STL, PF, TO, PTS | 能对上 | 比虎扑多 OR/DR；另有 miscellaneous DD2/TD3 |
| (虎扑无) 单场日志 | common/v3 athletes/{id}/gamelog → seasonTypes[].categories[].events[].stats；events{} 对阵 | 额外 | ESPN 有、虎扑没有 |
| 球队页·主场馆/赛区 | teams/{id}: franchise.venue.fullName, standingSummary("1st in Pacific Division") | 能对上 |  |
| 球队页·主教练 | teams/{id}/roster → coach[] | 能对上 | JJ Redick |
| 球队页·官网/简介 | links[] (ESPN 链接) | 对不上 | 官网/中文简介手填 |
| 球队页·场均与联盟排名 | core seasons/2027/types/2/teams/{id}/statistics splits.categories[].stats[].rank/rankDisplayValue | 能对上 |  |
| 球队页·阵容 号码/球员 | teams/{id}/roster athletes[].jersey/displayName/dateOfBirth | 能对上 |  |
| 球队页·球员比赛数据 | 每名球员 athletes/{id}/stats 或 byathlete 过滤 team | 部分(推导) | 无一次返回整队表的已验证接口 |
| 球队页·近5/未来5场 | teams/{id}/schedule；teams/{id} nextEvent；summary lastFiveGames | 能对上 |  |
| 评分(用户打分) | — | 不建议 | UGC，不对应且不建议采集 |
| 论坛帖 | — | 不建议 | 同上 |