// Apply a schema/migration .sql file(s) via DATABASE_URL. Usage: npx tsx src/load-schema.ts file1.sql [file2.sql...]
import pg from "pg"; import { readFileSync } from "node:fs";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
for (const f of process.argv.slice(2)) { await c.query(readFileSync(f, "utf8")); console.log("applied", f); }
await c.end();
