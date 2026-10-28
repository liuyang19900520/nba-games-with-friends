import pg from "pg"; import {readFileSync} from "fs"; const c=new pg.Client({connectionString:process.env.DATABASE_URL}); await c.connect();
console.log(JSON.stringify((await c.query(readFileSync("/workspace/work/nba-sync/counts.sql","utf8"))).rows.map(r=>r.t+"="+r.count).join(" "))); await c.end();
