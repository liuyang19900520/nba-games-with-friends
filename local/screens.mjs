import { chromium } from "playwright";
const b = await chromium.launch(); const base = "http://127.0.0.1:8787/#";
const pages = [["games", "/games?date=2026-10-27"], ["game-detail", "/game/401909877"], ["teams", "/teams"], ["team-lal", "/team/13"],
  ["player-doncic", "/player/3945274"], ["player-wembanyama", "/player/5104157"], ["stats-ppg", "/stats?season=2027&sort=ppg"], ["stats-ts", "/stats?season=2027&sort=ts_pct"]];
for (const [vp, opt] of [["mobile", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }], ["desktop", { viewport: { width: 1280, height: 900 } }]]) {
  const p = await b.newPage({ ...opt, locale: "zh-CN" });
  for (const [n, h] of pages) {
    await p.goto(base + h); await p.waitForFunction(() => !document.body.innerText.includes("加载中")); await p.waitForTimeout(900);
    await p.screenshot({ path: `screens/${n}-${vp}.png`, fullPage: vp === "desktop" }); console.log(vp, n, (await p.innerText("main")).slice(0, 90).replace(/\n/g, " | "));
  }
  await p.close();
}
await b.close();
