import pg from "pg"; import { readFileSync } from "node:fs";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
const sql = process.argv[2].endsWith(".sql") ? readFileSync(process.argv[2], "utf8") : process.argv[2];
const r: any = await c.query(sql); for (const x of [].concat(r)) if ((x as any).rows) console.table((x as any).rows); await c.end();
