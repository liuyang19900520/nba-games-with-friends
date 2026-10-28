# NBA MVP v2 — Public JSON API contract (`/api/v1`) — IMPLEMENTED 2026-10-28 23:25 JST

**Status:** all endpoints live on the local runner `http://127.0.0.1:8787/api/v1` (DB = PGlite :5433 with a full ESPN sync of 2026-27 to date + 2025-26 player season stats).
**Real (trimmed) responses for every endpoint: `API-EXAMPLES.md`** — treat those as the source of truth for field names; the hand-written examples below are illustrative.
Changes vs the first draft (all additive): every game has `state` (`pre|in|final`) + `status_zh`; list games carry `leaders.home|away.{pts,reb,ast}`; leader rows carry `gp` + `stats{}`;
`player.contracts[]`; `team.standing` in team detail; `/games?from=&to=`; `/games/:id/plays?since=seq`; `/players?active=0` (include inactive); `/teams/:id` `team_stats = {espn:{gp,stats{name:{value,display,rank}}}, from_box_scores:{...}}`; `executives` is always `null` (ESPN has no front-office data).


Owner: data/API worker. Frontend (Taro, /workspace/work/nba-mvp/app) consumes this. Requests → `FRONTEND-REQUESTS.md`.

- Base URL (local): `http://127.0.0.1:8787` · prod: CloudFront → Lambda (ap-northeast-1). Prefix `/api/v1`.
- GET only, CORS `*`, JSON UTF-8, `cache-control` set per endpoint (live short, final/reference long).
- IDs = ESPN ids (number). Dates: `game_date` = US/Eastern contest day `YYYY-MM-DD`; timestamps ISO-8601 UTC (`...Z`) — frontend converts to Asia/Shanghai/Tokyo.
- `season` = ESPN season year = year the season ENDS: **2027 = 2026-27**, 2026 = 2025-26. `season_type`: 1 preseason, 2 regular, 3 playoffs, 5 play-in.
- Percentages are 0–100 numbers (e.g. `48.7`), averages 1 decimal.
- Errors: `{ "error": { "code": "not_found", "message": "..." } }` with 4xx/5xx.
- Every list response wraps in an object (`{ "teams": [...] }`), never a bare array.

## Locale convention
- Every team object: `name` (ESPN English), `name_zh` (static table, all 30 teams), `abbr` (ESPN: GS, NY, SA, NO, UTAH, WSH...), `short_name`, `short_name_zh` (e.g. 湖人).
- Player: `name` (ESPN), `name_zh` (nullable; filled only where we have a mapping — frontend falls back to `name`).
- Position: `position` (ESPN abbr: PG, SG, SF, PF, C, G, F, G-F, F-C...), `position_zh` (控球后卫, 得分后卫, 小前锋, 大前锋, 中锋, 后卫, 前锋, 锋卫摇摆, 锋线/中锋).
- Conference/division: `conference` ("East"/"West"), `conference_zh` (东部/西部), `division_zh`.
- Stat labels: `GET /api/v1/meta` returns `stat_labels` {key: {en, zh, abbr}} for every stat key used below.
- `?locale=` is accepted but ignored (both languages always returned).

## Snapshot mode (static JSON, for Tencent COS / CloudBase / CDN)
`DATABASE_URL=... npx tsx scripts/export-snapshot.ts --out=snapshot` (in /workspace/work/nba-web; ~80 s, ~1,000 files, ~42 MB for the current season) calls the same handler for every endpoint and writes files whose paths mirror the URL:
`/api/v1/teams` → `snapshot/api/v1/teams.json`; `/api/v1/games?date=2026-10-27` → `snapshot/api/v1/games/date/2026-10-27.json`; `/api/v1/players/4065648` → `snapshot/api/v1/players/4065648.json`;
`/api/v1/leaders?category=pts` → `snapshot/api/v1/leaders/category/pts.json`; `/api/v1/games?team=13` → `snapshot/api/v1/games/team/13.json`.
Rule: query keys sorted asc, appended as `/key/value` path segments; no query → `<path>.json`. Exported: meta, teams, standings, injuries, every team (+ its schedule), leaders (basic/advanced/all + every category), players list (active + all), every active/with-stats player, games for every date of the season, every played game detail. Full file list in `snapshot/index.json`.
The local runner also serves the snapshot under `http://127.0.0.1:8787/snapshot/...` for testing.
Frontend: set `API_MODE=snapshot` and build the URL with `snapshotPath(path, query)` (rules in index.json `rules`). Upload the folder to COS; or have a Tencent SCF proxy forward `/api/v1/*` to the overseas API.

## Endpoints

| # | Path | Notes |
|---|---|---|
| 1 | `/api/v1/health` | db check |
| 2 | `/api/v1/meta` | seasons list, current season, season types, stat labels zh/en, leader categories, team zh table, positions zh |
| 3 | `/api/v1/teams` | 30 teams + current standing summary |
| 4 | `/api/v1/teams/:id` | info, venue, coaches, record splits, roster (bio + per-game averages + league ranks + salary + injury), schedule (all games of season with result), team season stats |
| 5 | `/api/v1/standings?season=` | by conference: rank, W-L, pct, GB, home, away, conf, div, last10, streak, PPG/OPP PPG/diff, seed |
| 6 | `/api/v1/players?q=&team=&position=&limit=&offset=` | list/search (English or Chinese substring) |
| 7 | `/api/v1/players/:id?season=&season_type=` | bio, injury, current season averages with league rank per stat, advanced (PER, TS%, eFG%, NBARating, usage, VORP...), all ESPN season stat lines (career by season), game log |
| 8 | `/api/v1/players/:id/gamelog?season=&season_type=` | full game log |
| 9 | `/api/v1/leaders?category=&season=&season_type=&type=basic|advanced&limit=&min_gp=` | ranked list; without `category` returns top 5 for every category |
| 10 | `/api/v1/games?date=YYYY-MM-DD` (or `?team=&season=`) | scoreboard / schedule |
| 11 | `/api/v1/games/:id` | full game detail |
| 12 | `/api/v1/games/:id/plays` | play-by-play (also included in #11 unless `?plays=0`) |
| 13 | `/api/v1/injuries` | league injury report grouped by team |
| 14 | `/api/v1/stats/players` | legacy alias of leaders (kept for old web/) |

### Leader categories (`category` key → zh)
basic: `pts` 得分, `reb` 篮板, `oreb` 前场篮板, `dreb` 后场篮板, `ast` 助攻, `stl` 抢断, `blk` 盖帽, `tov` 失误, `pf` 犯规, `min` 上场时间, `fg_pct` 投篮命中率, `fgm` 场均投篮命中, `fg3m_total` 三分总命中数, `fg3m` 场均三分命中, `fg3_pct` 三分命中率, `ft_pct` 罚球命中率, `ftm` 场均罚球命中, `dd2` 两双, `td3` 三双, `pts_total` 总得分.
advanced: `per` PER效率值, `ts_pct` 真实命中率, `efg_pct` 有效命中率, `nba_rating` NBA评分, `usage_rate` 球权使用率, `vorp` VORP, `ast_to` 助攻失误比, `reb_rate` 篮板率, `pts_per_poss` 每回合得分, `plus_minus` 正负值, `stl_to` 抢断失误比.
Qualification (like ESPN/NBA): per-game & % categories require `gp >= ceil(0.7 * team_games_played)` (min 1) ; `fg_pct` also `fgm >= 300*frac`, simplified: fga per game >= 5; `fg3_pct` fg3a per game >= 2 (early season: ≥1); `ft_pct` fta per game >= 1.5. Totals unqualified. `min_gp` overrides.
Rank = SQL `rank()` (ties share rank). Each player stat object on player detail carries `{ value, rank }`.

## Example responses (abbreviated real ESPN data; `...` = more of same)

### GET /api/v1/meta
```json
{"current_season":2027,"current_season_label":"2026-27","today_et":"2026-10-28",
 "seasons":[{"season":2027,"label":"2026-27","types":[1,2]},{"season":2026,"label":"2025-26","types":[2,3]}],
 "season_types":{"1":{"en":"Preseason","zh":"季前赛"},"2":{"en":"Regular Season","zh":"常规赛"},"3":{"en":"Postseason","zh":"季后赛"},"5":{"en":"Play-In","zh":"附加赛"}},
 "leader_categories":{"basic":[{"key":"pts","zh":"得分","en":"Points","unit":"per_game"}, "..."],"advanced":[{"key":"per","zh":"PER效率值","en":"PER"}, "..."]},
 "positions_zh":{"PG":"控球后卫","SG":"得分后卫","SF":"小前锋","PF":"大前锋","C":"中锋","G":"后卫","F":"前锋"},
 "stat_labels":{"pts":{"en":"Points","zh":"得分","abbr":"PTS"},"oreb":{"en":"Offensive Rebounds","zh":"前场篮板","abbr":"OREB"}, "...":{}},
 "teams_zh":{"13":{"name_zh":"洛杉矶湖人","short_name_zh":"湖人"}, "...":{}}}
```

### GET /api/v1/teams
```json
{"season":2027,"teams":[{"id":13,"abbr":"LAL","name":"Los Angeles Lakers","name_zh":"洛杉矶湖人","short_name":"Lakers","short_name_zh":"湖人",
  "location":"Los Angeles","color":"#552583","alt_color":"#fdb927","logo_url":"https://a.espncdn.com/i/teamlogos/nba/500/lal.png",
  "conference":"West","conference_zh":"西部","division":"Pacific","division_zh":"太平洋赛区",
  "standing":{"conf_rank":4,"wins":3,"losses":0,"win_pct":1.0,"games_behind":0.5,"home":"2-0","away":"1-0","streak":"W3","last10":"3-0","summary":"1st in Pacific Division"}}, "..."]}
```

### GET /api/v1/teams/13
```json
{"team":{"id":13,"abbr":"LAL","name":"Los Angeles Lakers","name_zh":"洛杉矶湖人","...":"(as list)",
   "venue":{"id":"...","name":"crypto.com Arena","city":"Los Angeles","state":"CA","capacity":null,"image_url":"..."},
   "coaches":[{"id":"3024","name":"JJ Redick","experience":2,"role":"Head Coach"}],
   "record":{"overall":{"wins":3,"losses":0,"avgPointsFor":128.0,"avgPointsAgainst":115.0,"differential":13.0,"playoffSeed":4,"streak":3,"...":0},"home":{"wins":2,"losses":0},"road":{"wins":1,"losses":0}},
   "standing_summary":"1st in Pacific Division"},
 "executives":null,
 "roster":[{"id":1966,"name":"LeBron James","name_zh":"勒布朗·詹姆斯","jersey":"23","position":"SF","position_zh":"小前锋",
   "age":41,"height":"6' 9\"","weight":"250 lbs","experience":23,"college":null,"salary":52627153,"injury":null,
   "headshot_url":"https://a.espncdn.com/i/headshots/nba/players/full/1966.png",
   "averages":{"gp":3,"gs":3,"min":34.1,"pts":25.3,"reb":7.7,"ast":8.0,"stl":1.0,"blk":0.7,"tov":3.3,"fg_pct":51.2,"fg3_pct":37.5,"ft_pct":80.0}}, "..."],
 "schedule":[{"id":401909861,"date":"2026-10-25","start_time":"2026-10-25T21:00:00Z","home_away":"away","opponent":{"id":26,"abbr":"UTAH","name_zh":"犹他爵士"},"status":"final","team_score":131,"opp_score":118,"result":"W"}, "..."],
 "team_stats":{"season":2027,"season_type":2,"gp":3,"stats":{"avgPoints":{"value":128.0,"rank":2,"display":"128.0"},"avgRebounds":{"value":45.0,"rank":5},"...":{}}}}
```

### GET /api/v1/standings?season=2027
```json
{"season":2027,"conferences":[{"name":"Western Conference","abbr":"West","name_zh":"西部","teams":[
  {"rank":1,"team":{"id":13,"abbr":"LAL","name_zh":"洛杉矶湖人","logo_url":"..."},"wins":3,"losses":0,"win_pct":1.0,"games_behind":0,
   "home":"2-0","away":"1-0","conf":"2-0","div":"1-0","last10":"3-0","streak":"W3","ppg":128.0,"opp_ppg":115.0,"diff":13.0,"seed":1,"clincher":null}, "..."]}, {"name":"Eastern Conference","...":"..."}]}
```

### GET /api/v1/players?q=wemb  (q matches name / name_zh, case-insensitive)
```json
{"total":1,"players":[{"id":5104157,"name":"Victor Wembanyama","name_zh":"维克托·文班亚马","team":{"id":24,"abbr":"SA","name_zh":"圣安东尼奥马刺"},
  "position":"C","position_zh":"中锋","jersey":"1","headshot_url":"...","age":22,"height":"7' 4\"","salary":13376880,"injury_status":null,
  "pts":24.0,"reb":11.0,"ast":3.0,"gp":3}]}
```

### GET /api/v1/players/5104157
```json
{"player":{"id":5104157,"name":"Victor Wembanyama","first_name":"Victor","last_name":"Wembanyama","name_zh":"维克托·文班亚马",
   "team":{"id":24,"abbr":"SA","name":"San Antonio Spurs","name_zh":"圣安东尼奥马刺","logo_url":"..."},
   "position":"C","position_zh":"中锋","jersey":"1","headshot_url":"https://a.espncdn.com/i/headshots/nba/players/full/5104157.png",
   "height_in":88,"height":"7' 4\"","weight_lb":235,"weight":"235 lbs","birth_date":"2004-01-04","age":22,"birth_place":"Le Chesnay, France",
   "college":null,"draft":{"year":2023,"round":1,"pick":1,"team":"SA","display":"2023: Rd 1, Pk 1 (SA)"},"experience":3,"debut_year":2023,
   "status":"Active","salary":13376880,"injury":null},
 "season":2027,"season_type":2,
 "averages":{"gp":{"value":3,"rank":null},"pts":{"value":24.0,"rank":12},"reb":{"value":11.0,"rank":6},"oreb":{"value":2.3,"rank":30},"dreb":{"value":8.7,"rank":5},
   "ast":{"value":3.0,"rank":80},"stl":{"value":1.0,"rank":40},"blk":{"value":3.7,"rank":1},"fg_pct":{"value":50.0,"rank":40},"fg3_pct":{"value":33.3,"rank":90},
   "ft_pct":{"value":85.0,"rank":30},"fg3m":{"value":2.0,"rank":40},"min":{"value":31.5,"rank":60}, "...":{}},
 "advanced":{"per":{"value":27.1,"rank":3},"ts_pct":{"value":61.2,"rank":20},"efg_pct":{"value":55.1,"rank":25},"nba_rating":{"value":8.1,"rank":4},
   "usage_rate":{"value":29.0,"rank":10},"vorp":{"value":0.4,"rank":5},"ast_to":{"value":1.2,"rank":120},"...":{}},
 "rank_pool":{"qualified":true,"players":212},
 "espn_stats":{"general":{"PER":27.1,"NBARating":8.1,"...":0},"offensive":{"...":0},"defensive":{"...":0}},
 "seasons":[{"season":2027,"label":"2026-27","season_type":2,"team_abbr":"SA","gp":3,"min":31.5,"pts":24.0,"reb":11.0,"ast":3.0,"stl":1.0,"blk":3.7,"fg_pct":50.0,"fg3_pct":33.3,"ft_pct":85.0,"per":27.1},
            {"season":2026,"label":"2025-26","season_type":2,"...":0}],
 "game_log":[{"game_id":401909870,"date":"2026-10-27","opponent":{"id":16,"abbr":"MIN","name_zh":"明尼苏达森林狼"},"home_away":"home","result":"W","score":"120-112",
   "starter":true,"min":33,"pts":28,"reb":12,"oreb":3,"dreb":9,"ast":4,"stl":1,"blk":5,"tov":2,"pf":3,"fgm":10,"fga":19,"fg3m":2,"fg3a":6,"ftm":6,"fta":7,"plus_minus":11}, "..."]}
```

### GET /api/v1/leaders?category=pts&season=2027&season_type=2&limit=3
```json
{"season":2027,"season_type":2,"category":{"key":"pts","zh":"得分","en":"Points","type":"basic"},"qualified_min_gp":2,
 "leaders":[{"rank":1,"value":36.5,"player":{"id":4278073,"name":"Shai Gilgeous-Alexander","name_zh":null,"headshot_url":"..."},"team":{"id":25,"abbr":"OKC","name_zh":"俄克拉荷马城雷霆"},"gp":3}, "..."]}
```
Without `category`: `{"season":2027,"season_type":2,"type":"basic","categories":[{"key":"pts","zh":"得分","leaders":[top5]}, ...]}`.

### GET /api/v1/games?date=2026-10-27
```json
{"date":"2026-10-27","games":[{"id":401909870,"date":"2026-10-27","start_time":"2026-10-27T23:30:00Z","status":"final","status_detail":"Final","period":4,"clock":"0.0",
  "season":2027,"season_type":2,
  "home":{"id":24,"abbr":"SA","name":"San Antonio Spurs","name_zh":"圣安东尼奥马刺","logo_url":"...","score":120,"record":"2-1","linescores":[30,28,31,31],"winner":true},
  "away":{"id":16,"abbr":"MIN","...":"","score":112,"record":"1-2","linescores":[25,30,27,30],"winner":false},
  "venue":{"name":"Frost Bank Center","city":"San Antonio"},"broadcasts":["ESPN"],"attendance":18354,
  "odds":{"provider":"Draft Kings","details":"SA -4.5","over_under":228.5},
  "leaders":{"home":{"pts":{"player_id":5104157,"name":"Victor Wembanyama","value":28}},"away":{"...":{}}}}]}
```
`?team=13&season=2027` → same shape, that team's full schedule. `?from=&to=` range (max 31 days).

### GET /api/v1/games/401909861
```json
{"game":{"id":401909861,"date":"2026-10-25","start_time":"...","status":"final","status_detail":"Final","period":4,"season":2027,"season_type":2,
   "home":{"...":"as list","linescores":[{"period":1,"points":28},"..."]},"away":{"...":""},
   "venue":{"id":3093,"name":"Delta Center","city":"Salt Lake City","state":"UT","image_url":"..."},"attendance":17867,"neutral_site":false,
   "officials":[{"name":"Mark Lindsay","position":"Referee","order":1}, "..."],
   "broadcasts":[{"type":"TV","market":"Away","station":"Spectrum SportsNet"}, "..."],
   "odds":[{"provider":"Draft Kings","details":"LAL -6.5","spread":6.5,"over_under":237.5,"home_moneyline":200,"away_moneyline":-250,"raw":{}}],
   "season_series":[{"summary":"LAL leads series 1-0","...":""}]},
 "team_stats":[{"team_id":13,"home_away":"away","stats":{"fieldGoalsMade-fieldGoalsAttempted":"40-82","fieldGoalPct":"49","threePointFieldGoalsMade-threePointFieldGoalsAttempted":"20-47","...":"","totalRebounds":"44","fastBreakPoints":"12","pointsInPaint":"40","largestLead":"20","turnovers":"..."}}, "..."],
 "box":[{"team_id":13,"players":[{"player_id":4433137,"name":"...","name_zh":null,"jersey":"8","position":"F","starter":true,"dnp":false,"dnp_reason":null,
    "min":32,"pts":20,"reb":5,"oreb":1,"dreb":4,"ast":2,"stl":1,"blk":0,"tov":1,"pf":2,"fgm":7,"fga":14,"fg3m":3,"fg3a":8,"ftm":3,"fta":3,"plus_minus":12}, "..."],
    "totals":{"pts":131,"...":0}}],
 "leaders":[{"team_id":13,"categories":[{"name":"points","zh":"得分","player_id":1966,"name":"LeBron James","value":"28"}, "..."]}],
 "injuries":[{"team_id":26,"player_id":4433137,"name":"...","status":"Out","detail":"Knee","date":"2026-10-24"}],
 "win_probability":[{"seq":4,"play_id":"4019098614","home_win_pct":37.2,"tie_pct":0}, "..."],
 "plays":[{"seq":11,"id":"40190986111","period":1,"clock":"11:07","type":"Jump Shot","text":"Ziaire Williams misses 26-foot three point jumper",
   "team_id":13,"scoring":false,"score_value":0,"away_score":2,"home_score":2,"shooting":true,"x":9,"y":21,"athletes":[4433137],"wallclock":"2026-10-25T21:12:39Z"}, "..."]}
```

### GET /api/v1/injuries
```json
{"updated_at":"2026-10-28T13:00:00Z","teams":[{"team":{"id":13,"abbr":"LAL","name_zh":"洛杉矶湖人"},"injuries":[
  {"player":{"id":...,"name":"...","name_zh":null,"position":"G","headshot_url":"..."},"status":"Out","status_zh":"缺阵","date":"2026-10-27","type":"Knee","detail":"...","side":"Left","return_date":"2026-11-05","short_comment":"...","long_comment":"..."}]}]}
```
status_zh: Out 缺阵, Day-To-Day 每日观察, Questionable 出战成疑, Doubtful 大概率缺阵, Probable 大概率出战, Suspension 禁赛.

## Stability
Fields may be ADDED any time; existing fields keep names/types. Nullable fields documented as such: `name_zh` (players), `salary`, `college`, `draft`, `injury`, `odds`, `attendance`, `venue.capacity`, ranks (null when not qualified).


## Regenerating examples / tests
- `cd /workspace/work/nba-web && tests/curl-test.sh` (54 curl+jq assertions, all endpoints, CORS, 404/400/405, snapshot==live).
- Examples: the python snippet that wrote `API-EXAMPLES.md` just GETs each endpoint and trims arrays.
