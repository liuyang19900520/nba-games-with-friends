# ESPN 公开接口 ↔ nba-games-with-friends 表映射（2026-10-28 JST 实测）

结论：**大部分能对上（部分匹配）**。比赛/球员/球队/box score/赛季均值字段基本都有；主要差异是 ID 体系（ESPN 自有 ID，无 NBA ID）、球队缩写、MM:SS→分钟、"M-A" 拆分、状态码；缺口是投篮区（shot_zone_*）、排名部分字段、高阶数据。

实测样本（curl，间隔1.5s）：scoreboard?dates=20261025/20261027、summary?event=401909861（LAL@UTA, Final）、teams、teams/9/roster、injuries、common/v3/.../statistics/byathlete、teams/9/schedule。

## 映射表
| 我们的表.列 | ESPN 来源 | 判定 |
|---|---|---|
| games.id (0022600xxx) | scoreboard events[].id = "401909861" | 需 crosswalk：按 (ET日期, 主队, 客队) 匹配 NBA gameId；或改用 ESPN id + nba_game_id 列 |
| games.season | events[].season.year=2027 (=2026-27), type 2 | 需转换（year-1 → "2026-27"） |
| games.game_datetime / is_time_tbd | events[].date "2026-10-27T23:30Z"（UTC，无秒） | 基本一致；TBD 标识未验证（status.type.detail 可能含 "TBD"） |
| games.status | status.type.name STATUS_SCHEDULED/…/STATUS_FINAL，state pre/in/post | 需转换 pre→Scheduled, in→Live, post→Final；延期/取消值未验证 |
| games.is_playoff | season.type (1 季前/2 常规/3 季后/5 附加赛*) | 需转换（*5 未验证） |
| games.home/away_team_id | competitions[0].competitors[].team.id + homeAway | 需 ID 映射（ESPN 1–30 → NBA 1610612xxx，静态 30 行表） |
| games.home/away_score | competitors[].score（字符串，赛前 "0"） | 需转换为 int；赛前 "0" 要当 null |
| games.arena_name | competitions[0].venue.fullName | 完全匹配 |
| 加时 | status.period（4 = 无加时，>4 = OT） | 可推导 |
| game_player_stats.player_id | boxscore.players[].statistics[0].athletes[].athlete.id "4433137" | 需 crosswalk（ESPN athlete id ≠ NBA person id） |
| …team_id | boxscore.players[].team.id | 需 ID 映射 |
| …min | stats[0] "30"（整数分钟字符串） | 需转换；与 NBA "PT30M12S"/MM:SS 精度不同（ESPN 无秒） |
| …pts/reb/ast/stl/blk/tov/pf | keys points/rebounds/assists/steals/blocks/turnovers/fouls | 完全匹配（字符串→int，按 keys 下标取） |
| …fgm/fga, fg3m/fg3a, ftm/fta | "3-9","3-7","2-2" | 需拆分 "M-A" |
| …fg_pct | 无（box 中） | 可推导 fgm/fga |
| …plus_minus | "+11" | 需转换（去 +） |
| OREB/DREB | offensiveRebounds/defensiveRebounds | 匹配（当前表未存） |
| DNP / starter | athletes[].didNotPlay / starter | 匹配（DNP 时 stats 为空数组需处理） |
| …fantasy_score | 无 | 自算（fantasy-scoring.json） |
| 两双/三双 | byathlete general.doubleDouble/tripleDouble（赛季累计） | 单场需自算 |
| players.id | roster athletes[].id | 需 crosswalk |
| players.first/last/full_name | firstName/lastName/fullName（英文） | 匹配；带变音/后缀(Jr.)差异需规范化 |
| players.jersey_num/position | jersey / position.abbreviation | 匹配 |
| players.height/weight | height 82.0(英寸)、weight 230.0(磅)、displayHeight 6' 10" | 需转换为现格式 |
| players.headshot_url | headshot.href (espncdn) | 匹配（URL 不同来源） |
| players.is_active | 在 roster 中即 active | 可推导 |
| teams.id/name/city/code | /teams: id, name/location/abbreviation | 需 ID 映射 + 缩写转换 GS/NO/NY/SA/UTAH/WSH → GSW/NOP/NYK/SAS/UTA/WAS |
| teams.conference | /teams 中未见；standings 接口 | 未验证 |
| teams.logo_url | team.logos[].href | 匹配（未逐字段验证） |
| player_season_stats.gp/min/pts/reb/ast/stl/blk/tov/fg_pct/fg3_pct/ft_pct | common/v3/.../statistics/byathlete categories general/offensive/defensive（avg*） | 匹配；需按 names 下标取；season 参数语义（season=2026 返回 2025-26?）需确认 |
| player_season_stats.fantasy_avg | 无 | 自算（由单场汇总） |
| team_standings.wins/losses/win_pct/conf_rank/home/road/streak | 未请求 | 未验证（site.api …/standings 大概率有，需实测） |
| player_shots.loc_x/loc_y/shot_made_flag/shot_type | summary.plays[].coordinate{x,y}、shootingPlay、scoringPlay、type.text、participants[0].athlete.id | 需转换（坐标系不同） |
| player_shots.shot_distance/shot_zone_basic/zone_area | 仅 text 中 "26-foot" | 缺失（距离可从文本/坐标推导，zone 需自算） |
| 伤病（目前无表） | /injuries: status "Day-To-Day", details.returnDate, fantasyStatus GTD | 新增可用 |
| 高阶数据（advanced_stats 服务） | 无 | 缺失 |

## 缺失/不可靠及处理
- box score 只在比赛进行/结束后有；赛前 stats 为空 → 轮询 state=post 后再落库，次日补跑一次修正。
- 季前赛 season.type=1 → 过滤掉。
- 非官方、无文档、无 SLA，可能改字段/限流（限流阈值未验证）→ 低频（每场结束后1次）、缓存原始 JSON、字段用 keys 名而非固定下标、校验失败告警。
- 历史深度：scoreboard?dates= 可回溯（实测仅当季），更早赛季未验证。
- 分钟数无秒精度。

## ID crosswalk 方案
1. 球队：静态 30 行映射表（ESPN id/缩写 ↔ NBA team_id/tricode），一次性写死。
2. 比赛：(美东日期, home NBA team_id, away NBA team_id) 唯一 → 对应已有 0022600xxx；新设计建议主键改 ESPN event id，保留 nba_game_id 列。
3. 球员：建 player_xwalk(espn_id, nba_id)。先按 规范化全名 + 球队 匹配，冲突再用 DOB（ESPN roster.dateOfBirth；NBA 侧需 commonplayerinfo，且从云 IP 可能被封）；剩余人工确认。开源映射表（如社区 GitHub 列表）存在性/新鲜度未验证，可作补充。或彻底改用 ESPN id 为主键，放弃 NBA id（老数据一次性迁移）。
