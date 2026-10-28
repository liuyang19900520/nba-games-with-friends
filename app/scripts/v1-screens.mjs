import { createRequire } from 'node:module'
const require = createRequire('/workspace/work/nba-web/package.json')
const { chromium } = require('playwright')
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })).newPage()
for (const [n, u] of [['home', '/home'], ['leagues', '/leagues'], ['match', '/match/401909877'], ['player', '/player/5104157'], ['team', '/team/13']]) {
  try { await p.goto('http://localhost:3100' + u, { timeout: 90000 }); await p.waitForTimeout(5000) } catch (e) { console.log(n, 'ERR', e.message) }
  await p.screenshot({ path: `/workspace/work/nba-mvp/screens/v1-${n}.png` }); console.log(n, (await p.innerText('body')).slice(0, 120).replace(/\n/g, ' | '))
}
await b.close()
