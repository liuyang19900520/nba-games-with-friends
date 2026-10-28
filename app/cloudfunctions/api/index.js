// WeChat cloud function proxy (API_MODE=cloud). Deploy in WeChat DevTools → 云开发. Forwards GET /api/v1/* to the overseas API.
// Set env API_ORIGIN (e.g. https://dxxxx.cloudfront.net). No ICP domain needed on the mini program side.
const https = require('https')
exports.main = async (event) => {
  const path = String(event.path || '')
  if (!path.startsWith('/api/v1/')) return { status: 400, body: { error: { code: 'bad_path', message: 'path must start with /api/v1/' } } }
  const url = (process.env.API_ORIGIN || '') + path
  return new Promise((resolve) => {
    https.get(url, { timeout: 8000 }, (res) => {
      let s = ''; res.setEncoding('utf8'); res.on('data', (c) => (s += c))
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(s) }) } catch (e) { resolve({ status: 502, body: { error: { code: 'bad_upstream', message: 'invalid JSON' } } }) } })
    }).on('error', (e) => resolve({ status: 502, body: { error: { code: 'upstream', message: e.message } } }))
  })
}
