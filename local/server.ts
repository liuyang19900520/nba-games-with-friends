// Local runner ONLY for testing (fixed port 8787, CORS on): invokes the SAME route() handlers per request (no extra logic).
// Also serves ./snapshot/** statically under /snapshot/ to test the static-JSON (COS/CDN) mode.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { route } from "../api/handlers.ts";
const SNAP = path.resolve(import.meta.dirname, "../snapshot");
const PORT = Number(process.env.PORT ?? 8787);
http.createServer(async (req, res) => {
  const u = new URL(req.url!, "http://x");
  const t0 = Date.now();
  if (u.pathname.startsWith("/api/")) {
    const r = await route({ method: req.method!, path: u.pathname, query: Object.fromEntries(u.searchParams) });
    res.writeHead(r.status, { ...r.headers, "x-runtime-ms": String(Date.now() - t0) }).end(req.method === "HEAD" ? undefined : r.body); return;
  }
  if (u.pathname.startsWith("/snapshot/")) {
    const f = path.join(SNAP, path.normalize(u.pathname.slice("/snapshot".length)));
    if (f.startsWith(SNAP) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" }).end(fs.readFileSync(f)); return;
    }
  }
  if (u.pathname === "/") { res.writeHead(302, { location: "/api/v1" }).end(); return; }
  res.writeHead(404, { "access-control-allow-origin": "*" }).end();
}).listen(PORT, "0.0.0.0", () => console.log("local runner http://127.0.0.1:" + PORT));
