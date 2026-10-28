// Dump every public table/view: columns + 3 sample rows -> HTML (for screenshots)
import pg from "pg"; import { writeFileSync } from "fs";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
const rels = (await c.query(`select table_name, table_type from information_schema.tables where table_schema='public' order by table_type, table_name`)).rows;
const esc = (s: any) => String(s ?? "∅").replace(/[&<>]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[x]!));
const short = (v: any) => { let s = v === null ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v); return s.length > 60 ? s.slice(0, 57) + "…" : s; };
let html = `<html><head><meta charset="utf-8"><style>body{font:12px -apple-system,"Noto Sans CJK SC",sans-serif;margin:16px;background:#f5f5f7}h2{font-size:15px;margin:18px 0 4px}table{border-collapse:collapse;background:#fff;margin-bottom:6px}td,th{border:1px solid #ddd;padding:3px 6px;white-space:nowrap;max-width:260px;overflow:hidden}th{background:#1d428a;color:#fff}.m{color:#888}</style></head><body><h1>nba v2 本地库（PGlite）— 每张表的列 + 3 行样例</h1>`;
const summary: any[] = [];
for (const r of rels) {
  const t = r.table_name; const n = (await c.query(`select count(*)::int n from ${t}`)).rows[0].n;
  const order = t === "player_game_stats" ? "order by pts desc nulls last" : t === "player_season_averages" ? "order by ppg desc nulls last" : t === "player_salaries" ? "order by salary desc" : t === "espn_raw" ? "" : "";
  const q = t === "espn_raw" ? `select id,job_id,endpoint,resource_key,url,http_status,sha256,left(payload::text,60) payload_preview,fetched_at from espn_raw limit 3` : `select * from ${t} ${order} limit 3`;
  const res = await c.query(q); summary.push({ t, type: r.table_type, n, cols: res.fields.map((f) => f.name) });
  html += `<h2>${t} <span class="m">(${r.table_type === "VIEW" ? "view" : "table"} · ${n} 行)</span></h2><table><tr>${res.fields.map((f) => `<th>${f.name}</th>`).join("")}</tr>${res.rows.map((row) => `<tr>${res.fields.map((f) => `<td>${esc(short(row[f.name]))}</td>`).join("")}</tr>`).join("") || `<tr><td class="m" colspan="${res.fields.length}">(空)</td></tr>`}</table>`;
}
writeFileSync("/workspace/work/nba-web/screens/db-tables.html", html + "</body></html>");
writeFileSync("/workspace/work/nba-web/screens/db-tables.json", JSON.stringify(summary, null, 1));
console.log(summary.map((s) => `${s.t}=${s.n}`).join(" ")); await c.end();
