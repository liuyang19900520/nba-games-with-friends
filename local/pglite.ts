// Local-only fixture DB (PGlite = WASM Postgres) on :5434, schema = /workspace/work/migrations/*.sql. Not used in prod.
import { PGlite } from "@electric-sql/pglite"; import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"; import fs from "node:fs";
const dir = process.env.PGLITE_DIR ?? ".pgdata"; const fresh = !fs.existsSync(dir);
const db = await PGlite.create(dir, { extensions: { pgcrypto } });
if (fresh) {
  await db.exec(`CREATE SCHEMA IF NOT EXISTS auth; CREATE TABLE IF NOT EXISTS auth.users(id uuid primary key);
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'select null::uuid';
    DO $$BEGIN CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; EXCEPTION WHEN others THEN NULL; END$$;`);
  for (const f of fs.readdirSync(new URL("../supabase/migrations", import.meta.url).pathname).sort()) { console.log("apply", f); await db.exec(fs.readFileSync(new URL("../supabase/migrations/" + f, import.meta.url).pathname, "utf8")); }
}
await new PGLiteSocketServer({ db, port: 5434, host: "127.0.0.1" }).start(); console.log("pglite :5434");
