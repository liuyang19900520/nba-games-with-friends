const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')

function loadTs(relative) {
  const filename = path.join(__dirname, '..', 'src', relative)
  const source = fs.readFileSync(filename, 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText
  const mod = new Module(filename, module)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(path.dirname(filename))
  mod._compile(js, filename)
  return mod.exports
}

const { calcFantasyScore, defaultRules, normalizeRules } = loadTs('lib/fantasy.ts')

test('default weights calculate a player line and omit an unearned bonus', () => {
  const out = calcFantasyScore({ pts: 10, reb: 4, ast: 3, stl: 1, blk: 0, tov: 2 })
  assert.equal(out.score, 10 + 4 * 1.2 + 3 * 1.5 + 3 - 2)
  assert.equal(out.bonus, undefined)
  assert.deepEqual(out.breakdown.map((x) => x.key), defaultRules.stats.map((x) => x.key))
})

test('negative weights subtract from the score', () => {
  const rules = { stats: defaultRules.stats.map((r) => r.key === 'tov' ? { ...r, weight: -2.5 } : r), doubleDouble: 0, tripleDouble: 0 }
  assert.equal(calcFantasyScore({ pts: 1, tov: 2 }, rules).score, -4)
})

test('double-double and triple-double awards are configurable and mutually exclusive', () => {
  const rules = { ...defaultRules, doubleDouble: 2.25, tripleDouble: 4.5 }
  const dd = calcFantasyScore({ pts: 10, reb: 10 }, rules)
  const td = calcFantasyScore({ pts: 10, reb: 10, ast: 10 }, rules)
  assert.equal(dd.bonus.key, 'doubleDouble')
  assert.equal(dd.bonus.points, 2.25)
  assert.equal(td.bonus.key, 'tripleDouble')
  assert.equal(td.bonus.points, 4.5)
})

test('double-double thresholds start at ten in two categories', () => {
  assert.equal(calcFantasyScore({ pts: 10, reb: 9 }).bonus, undefined)
  assert.equal(calcFantasyScore({ pts: 10, reb: 10 }).bonus.key, 'doubleDouble')
})

test('less common box stats accept fractional positive and negative weights', () => {
  const rules = normalizeRules({ stats: [
    { key: 'pf', weight: 0.5 }, { key: 'fgm', weight: -0.25 },
    { key: 'fga', weight: 0.1 }, { key: 'ftm', weight: -1.5 },
  ], doubleDouble: 0, tripleDouble: 0 })
  const out = calcFantasyScore({ pf: 2, fgm: 4, fga: 10, ftm: 1 }, rules)
  assert.equal(rules.stats.find((r) => r.key === 'pf').weight, 0.5)
  assert.equal(out.breakdown.find((r) => r.key === 'fgm').points, -1)
  assert.equal(out.breakdown.find((r) => r.key === 'fga').points, 1)
  assert.equal(out.breakdown.find((r) => r.key === 'ftm').points, -1.5)
})

test('damaged stored values fall back to defaults instead of numeric coercion', () => {
  const rules = normalizeRules({ stats: [{ key: 'pts', weight: '2.5' }, { key: 'reb', weight: true }], doubleDouble: '', tripleDouble: null })
  assert.equal(rules.stats.find((r) => r.key === 'pts').weight, 1)
  assert.equal(rules.stats.find((r) => r.key === 'reb').weight, 1.2)
  assert.equal(rules.doubleDouble, 1.5)
  assert.equal(rules.tripleDouble, 3)
})

test('missing fields count as zero and DNP has no score or breakdown', () => {
  assert.equal(calcFantasyScore({ pts: 2 }).score, 2)
  assert.deepEqual(calcFantasyScore({ dnp: true, pts: 20 }), { score: 0, breakdown: [], dnp: true })
})

test('real BKN at BOS fixture computes a player score from the box line', () => {
  const fixture = require('../static/mock/api/v1/games/401909877.json')
  const player = fixture.box.find((b) => b.team_id === fixture.game.home.id).players.find((p) => p.name === 'Jayson Tatum')
  const out = calcFantasyScore(player)
  assert.equal(player.pts, 40)
  assert.equal(out.score, 40 + 5 * 1.2 + 8 * 1.5 + 1 * 3)
})
