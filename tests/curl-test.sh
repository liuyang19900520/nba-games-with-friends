#!/usr/bin/env bash
# curl tests for every endpoint against the local runner (default http://127.0.0.1:8787). Usage: tests/curl-test.sh [base]
set -u
B=${1:-http://127.0.0.1:8787}; pass=0; fail=0
t() { # name, path, jq assertion (must print true)
  local out code; out=$(mktemp); code=$(curl -s -o "$out" -w "%{http_code}" "$B$2")
  if [ "$code" = "${4:-200}" ] && [ "$(jq -r "$3" "$out" 2>/dev/null)" = "true" ]; then pass=$((pass+1)); printf "PASS %-28s %s (%s B)\n" "$1" "$2" "$(wc -c <"$out")";
  else fail=$((fail+1)); printf "FAIL %-28s %s -> %s %s\n" "$1" "$2" "$code" "$(head -c 200 "$out")"; fi; rm -f "$out"; }
GAME=$(curl -s "$B/api/v1/games?date=2026-10-25" | jq -r '.games[0].id')
PLAYER=5104157
t health        /api/v1/health '.ok == true'
t index         /api/v1 '.routes | length >= 14'
t meta          /api/v1/meta '.current_season == 2027 and (.teams_zh | length) == 30 and (.leader_categories.basic | length) > 10'
t teams         /api/v1/teams '(.teams | length) == 30 and (.teams[0].name_zh | length) > 0 and .teams[0].standing.wins != null'
t team          /api/v1/teams/13 '.team.abbr == "LAL" and (.roster | length) > 10 and (.schedule | length) > 70 and .team.venue.name != null and (.team.coaches | length) >= 1 and .team.standing != null'
t team_404      /api/v1/teams/999 '.error.code == "not_found"' 404
t standings     /api/v1/standings '(.conferences | length) == 2 and (.conferences[0].teams | length) == 15'
t standings_prev "/api/v1/standings?season=2027" '.season == 2027'
t players       "/api/v1/players?limit=5" '(.players | length) == 5 and .total > 400'
t players_q     "/api/v1/players?q=wemb" '.players[0].id == 5104157'
t players_q_zh  "/api/v1/players?q=%E6%96%87%E7%8F%AD" '.players[0].id == 5104157'
t players_team  "/api/v1/players?team=LAL" '(.players | length) > 10 and all(.players[]; .team.abbr == "LAL")'
t players_pos   "/api/v1/players?position=C&limit=3" 'all(.players[]; .position == "C")'
t player        /api/v1/players/$PLAYER '.player.name == "Victor Wembanyama" and .player.draft.pick == 1 and .averages.pts.value > 0 and .averages.pts.rank >= 1 and .advanced.per.value > 0 and (.seasons | length) >= 2 and (.game_log | length) > 0'
t player_prev   "/api/v1/players/$PLAYER?season=2026" '.season == 2026 and .averages.gp.value > 50 and .advanced.per.rank != null'
t player_404    /api/v1/players/1 '.error.code == "not_found"' 404
t player_bad    /api/v1/players/abc '.error.code == "bad_id"' 400
t gamelog       /api/v1/players/$PLAYER/gamelog '(.games | length) > 0 and .games[0].opponent.abbr != null'
t leaders_all   /api/v1/leaders '(.categories | length) > 15 and (.categories[0].leaders | length) == 5'
t leaders_adv   "/api/v1/leaders?type=advanced" '.type == "advanced" and .categories[0].key == "per" and (.categories[0].leaders | length) > 0'
for c in pts reb oreb dreb ast stl blk fg_pct fg3m_total fg3m fg3_pct ft_pct per ts_pct efg_pct nba_rating dd2; do
  t "leaders_$c" "/api/v1/leaders?category=$c&limit=10" "(.leaders | length) >= 10 and .leaders[0].rank == 1 and .leaders[0].stats.pts != null"; done
t leaders_prev  "/api/v1/leaders?category=pts&season=2026&limit=3" '.season == 2026 and .leaders[0].gp > 40'
t leaders_bad   "/api/v1/leaders?category=nope" '.error.code == "bad_category"' 400
t games_date    "/api/v1/games?date=2026-10-25" '(.games | length) > 0 and .games[0].state == "final" and (.games[0].home.linescores | length) >= 4 and .games[0].leaders.home.pts.player_name != null'
t games_today   /api/v1/games '.date != null and (.games | type) == "array"'
t games_team    "/api/v1/games?team=LAL" '(.games | length) > 70'
t games_range   "/api/v1/games?from=2026-10-20&to=2026-10-27" '(.games | length) > 20'
t games_baddate "/api/v1/games?date=2026-1-1" '.error.code == "bad_date"' 400
t game          /api/v1/games/$GAME '.game.id == '"$GAME"' and (.box | length) == 2 and (.box[0].players | length) > 5 and (.team_stats | length) == 2 and (.game.officials | length) >= 3 and (.plays | length) > 300 and (.win_probability | length) > 100 and (.game.linescores | length) >= 8 and .game.attendance > 0 and (.leaders[0].categories[0].player_name | length) > 0'
t game_noplays  "/api/v1/games/$GAME?plays=0" '.plays == null'
t game_plays    "/api/v1/games/$GAME/plays?since=100" '.plays[0].seq > 100'
t injuries      /api/v1/injuries '.total > 0 and (.teams[0].injuries[0].status | length) > 0'
t legacy        "/api/v1/stats/players?sort=rpg" '.category.key == "reb"'
t unknown       /api/v1/nope '.error.code == "not_found"' 404
# CORS + preflight
c=$(curl -s -D - -o /dev/null "$B/api/v1/health" | grep -ci '^access-control-allow-origin: \*'); [ "$c" = 1 ] && { pass=$((pass+1)); echo "PASS cors"; } || { fail=$((fail+1)); echo "FAIL cors"; }
c=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$B/api/v1/teams"); [ "$c" = 204 ] && { pass=$((pass+1)); echo "PASS preflight"; } || { fail=$((fail+1)); echo "FAIL preflight $c"; }
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/api/v1/teams"); [ "$c" = 405 ] && { pass=$((pass+1)); echo "PASS post_405"; } || { fail=$((fail+1)); echo "FAIL post $c"; }
# snapshot mode (if exported): same body as live
if [ -f "$(dirname "$0")/../snapshot/api/v1/teams.json" ]; then
  a=$(curl -s "$B/snapshot/api/v1/standings.json" | jq -c '.conferences[0].teams[0].team.id'); b=$(curl -s "$B/api/v1/standings" | jq -c '.conferences[0].teams[0].team.id')
  [ "$a" = "$b" ] && [ -n "$a" ] && { pass=$((pass+1)); echo "PASS snapshot_matches_live"; } || { fail=$((fail+1)); echo "FAIL snapshot $a vs $b"; }
fi
echo "== $pass passed, $fail failed"; [ $fail = 0 ]
