// Local dev only: PGlite (WASM Postgres) exposed on a TCP port so the same pg/DATABASE_URL code path is used.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
const db = await PGlite.create(process.env.PGLITE_DIR ?? "/workspace/work/nba-sync/.pgdata");
const server = new PGLiteSocketServer({ db, port: Number(process.env.PGPORT ?? 5433), host: "127.0.0.1", maxConnections: Number(process.env.PG_MAX_CONN ?? 8) });
await server.start();
console.log("pglite listening on 127.0.0.1:" + (process.env.PGPORT ?? 5433));
