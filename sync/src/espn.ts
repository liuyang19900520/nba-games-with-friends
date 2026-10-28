// Polite ESPN fetcher: UA, <=1 req/s, retry w/ backoff, on-disk cache.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const UA = process.env.ESPN_UA ?? "nba-games-with-friends-sync/0.2 (non-commercial hobby; low-frequency)";
const CACHE = process.env.ESPN_CACHE_DIR ?? "/workspace/work/espn-cache";
const MIN_GAP_MS = Number(process.env.ESPN_MIN_GAP_MS ?? 1000);
mkdirSync(CACHE, { recursive: true });

export const stats = { requests: 0, cacheHits: 0, retries: 0, emptyBodies: 0, errors: [] as string[], notFound: 0, statusCounts: {} as Record<string, number> };
const lastByHost: Record<string, number> = {};
// per-host politeness: site.api 1 req/s, core API (lighter, separate host) 0.6 s
const gapFor = (host: string) => (host.startsWith("sports.core") ? Number(process.env.ESPN_CORE_GAP_MS ?? 600) : MIN_GAP_MS);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Fetched { url: string; body: any; sha256: string; fetchedAt: Date; httpStatus: number; fromCache: boolean }

/** ttlSec: Infinity = immutable (final games / past days), 0 = always refetch */
export async function getJson(url: string, ttlSec: number): Promise<Fetched> {
  const key = createHash("sha1").update(url).digest("hex");
  const f = join(CACHE, key + ".json");
  if (ttlSec > 0 && existsSync(f)) {
    const age = (Date.now() - statSync(f).mtimeMs) / 1000;
    if (age < ttlSec) {
      const c = JSON.parse(readFileSync(f, "utf8"));
      stats.cacheHits++;
      return { url, body: c.body, sha256: c.sha256, fetchedAt: new Date(c.fetchedAt), httpStatus: c.httpStatus, fromCache: true };
    }
  }
  for (let attempt = 0; ; attempt++) {
    const host = new URL(url).host;
    const wait = (lastByHost[host] ?? 0) + gapFor(host) - Date.now();
    if (wait > 0) await sleep(wait);
    lastByHost[host] = Date.now();
    stats.requests++;
    try {
      // ESPN CDN sometimes serves a cached 200 with empty body; vary the URL on retry
      const u = attempt >= 1 ? url + (url.includes("?") ? "&" : "?") + "lang=en&region=us" + (attempt >= 2 ? "&_cb=" + Date.now() : "") : url;
      const res = await fetch(u, { headers: { "User-Agent": UA, Accept: "application/json" } });
      stats.statusCounts[res.status] = (stats.statusCounts[res.status] ?? 0) + 1;
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) { stats.errors.push(`${res.status} ${url}`); throw Object.assign(new Error(`HTTP ${res.status} ${url}`), { fatal: true }); }
      const text = await res.text();
      if (!text.trim()) { stats.emptyBodies++; throw new Error("empty 200 body"); }
      const body = JSON.parse(text);
      const sha256 = createHash("sha256").update(text).digest("hex");
      const fetchedAt = new Date();
      writeFileSync(f, JSON.stringify({ url, fetchedAt, httpStatus: res.status, sha256, body }));
      return { url, body, sha256, fetchedAt, httpStatus: res.status, fromCache: false };
    } catch (e: any) {
      if (e.fatal || attempt >= 4) { stats.errors.push(`${e.message} ${url}`); throw e; }
      stats.retries++;
      await sleep(2000 * 2 ** attempt + Math.random() * 500);
    }
  }
}

/** like getJson but 404 -> null (e.g. no stats for a player/season); 404s are cached for ttl too */
export async function getJsonOpt(url: string, ttlSec: number): Promise<Fetched | null> {
  const key = createHash("sha1").update(url).digest("hex");
  const nf = join(CACHE, key + ".404");
  if (ttlSec > 0 && existsSync(nf) && (Date.now() - statSync(nf).mtimeMs) / 1000 < ttlSec) { stats.cacheHits++; return null; }
  try { return await getJson(url, ttlSec); }
  catch (e: any) { if (/HTTP 404/.test(e.message)) { stats.errors = stats.errors.filter((x) => !x.includes(url)); stats.notFound = (stats.notFound ?? 0) + 1; writeFileSync(nf, ""); return null; } throw e; }
}

const CORE = "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba";
const SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
export const urls = {
  teams: () => `${SITE}/teams`,
  roster: (id: string | number) => `${SITE}/teams/${id}/roster`,
  scoreboard: (yyyymmdd: string) => `${SITE}/scoreboard?dates=${yyyymmdd}&limit=100`,
  summary: (eventId: string | number) => `${SITE}/summary?event=${eventId}`,
  team: (id: string | number) => `${SITE}/teams/${id}`,
  teamStats: (id: string | number, season: number, type = 2) => `${SITE}/teams/${id}/statistics?season=${season}&seasontype=${type}`,
  schedule: (id: string | number, season: number) => `${SITE}/teams/${id}/schedule?season=${season}`,
  injuries: () => `${SITE}/injuries`,
  standings: (season: number) => `https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=${season}`,
  coreAthlete: (id: string | number) => `${CORE}/athletes/${id}`,
  coreStats: (id: string | number, season: number, type: number) => `${CORE}/seasons/${season}/types/${type}/athletes/${id}/statistics`,
};
