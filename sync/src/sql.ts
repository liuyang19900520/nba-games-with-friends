// tiny local SQL runner: npx tsx src/sql.ts file.sql  (or "SELECT ...")
import pg from "pg"; import fs from "node:fs";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
const a = process.argv[2]; const text = fs.existsSync(a) ? fs.readFileSync(a, "utf8") : a;
for (const q of text.split(/;\s*\n/).filter((x) => x.trim())) console.table((await c.query(q)).rows);
await c.end();
