// Pooled connection created OUTSIDE the handler -> reused across warm invocations of one Lambda container.
// Point DATABASE_URL at the Supabase *transaction pooler* (port 6543) so short-lived functions never exhaust Postgres connections.
import pg from "pg";
pg.types.setTypeParser(1082, (v) => v); // date -> 'YYYY-MM-DD'
pg.types.setTypeParser(20, (v) => Number(v)); // bigint -> number (ids/salary fit in 2^53)
pg.types.setTypeParser(1700, (v) => Number(v)); // numeric -> number
let pool: pg.Pool | undefined;
export function db() {
  if (!pool) pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 3_000,
    statement_timeout: 5_000, query_timeout: 6_000,
    ssl: /sslmode=require|supabase/.test(process.env.DATABASE_URL ?? "") ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}
export const q = async <T = any>(sql: string, params: unknown[] = []) => (await db().query(sql, params)).rows as T[];
