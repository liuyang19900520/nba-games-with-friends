// Screenshot the H5 build (served at H5 URL) at 390x844. Usage: node scripts/screens.mjs [baseUrl] [suffix] [lang]
import { createRequire } from 'node:module'
const require = createRequire('/workspace/work/nba-web/package.json')
const { chromium } = require('playwright')
const base = process.argv[2] || 'http://127.0.0.1:8090/#'
const suf = process.argv[3] || ''
const lang = process.argv[4] || 'zh-CN'
const pages = (process.env.PAGES ? JSON.parse(process.env.PAGES) : [
  ['01-schedule', '/pages/index/index?date=2026-10-27'],
  ['02-leaders', '/pages/leaders/index'],
  ['03-leaderlist-pts', '/pages/leaderlist/index?cat=pts&season=2027&type=2&name=%E5%BE%97%E5%88%86'],
  ['04-standings', '/pages/standings/index'],
  ['05-team-lal', '/pages/team/index?id=13'],
  ['06-player-wemby', '/pages/player/index?id=5104157'],
  ['07-game-detail', '/pages/game/index?id=401909877'],
  ['08-more', '/pages/more/index'],
])
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: +(process.env.W || 390), height: +(process.env.H || 844) }, deviceScaleFactor: 2, locale: lang, isMobile: true, hasTouch: true })
const p = await ctx.newPage()
p.on('pageerror', (e) => console.log('PAGEERROR', e.message))
for (const [n, h] of pages) {
  await p.goto(base + h)
  await p.waitForTimeout(800)
  await p.waitForFunction(() => !document.body.innerText.includes('加载中') && !document.body.innerText.includes('Loading'), null, { timeout: 15000 }).catch(() => {})
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${process.env.OUT || '/workspace/work/nba-mvp/screens/'}${n}${suf}.png` })
  console.log(n, (await p.innerText('body')).slice(0, 140).replace(/\n/g, ' | '))
  // extra: click through tabs on detail pages
  if (/team|player|game/.test(n)) {
    const tabs = await p.$$('.tabs .tab')
    for (let i = 1; i < tabs.length; i++) {
      await tabs[i].click(); await p.waitForTimeout(1200)
      await p.screenshot({ path: `${process.env.OUT || '/workspace/work/nba-mvp/screens/'}${n}-tab${i}${suf}.png` })
    }
  }
}
await b.close()
