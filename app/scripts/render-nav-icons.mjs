// Render v1 bottom-nav icons (lucide-react 0.427 Home/Trophy/Users/User + v1 custom basketball) to PNG (dim + active).
import { createRequire } from 'node:module'
const { chromium } = createRequire('/workspace/work/nba-web/package.json')('playwright')
const P = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  ball: '<circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
}
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 96, height: 96 } })
for (const [n, d] of Object.entries(P)) for (const [suf, c] of [['', '#7A8B99'], ['-on', '#6EE2F5']]) {
  const sw = n === 'ball' ? 1.5 : 2
  await p.setContent(`<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg></body></html>`)
  await p.screenshot({ path: `src/assets/nav/${n}${suf}.png`, omitBackground: true })
}
await b.close()
