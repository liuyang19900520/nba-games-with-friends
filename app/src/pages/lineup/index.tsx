// Lineup — Step 1 of core gameplay: pick 5 players (C, F1, F2, G1, G2) under the daily salary cap,
// lock lineup before tip-off, then jump to Matchups for live box-score scoring & friends PK.
import { View, Text, Input, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { api, asset } from '../../lib/api'
import { t, getLang } from '../../lib/i18n'
import { useFetch, useTabPage, go } from '../../lib/hooks'
import { addDays, etToday, localTime, money, stat } from '../../lib/fmt'
import { teamName, logoOf, headshotOf } from '../../lib/teams'
import { fullName, tableName } from '../../lib/names'
import {
  Slot, LINEUP_SLOTS, loadLineup, saveLineup, loadCap, saveCap, loadRule, loadRoom,
  getPlayerDailyBox, calcPlayerScore, buildAutoLineup,
} from '../../lib/scoring'
import { Loader, Img } from '../../components/ui'
import BottomNav from '../../components/BottomNav'
import './index.less'

const SLOTS: { key: Slot; base: 'C' | 'F' | 'G'; cls: string }[] = [
  { key: 'C', base: 'C', cls: 's-c' },
  { key: 'F1', base: 'F', cls: 's-f1' },
  { key: 'F2', base: 'F', cls: 's-f2' },
  { key: 'G1', base: 'G', cls: 's-g1' },
  { key: 'G2', base: 'G', cls: 's-g2' },
]
const TODAY = process.env.TARO_APP_DEFAULT_DATE || etToday()
const zh = () => getLang() === 'zh'
const fits = (pos: string, base: string) => String(pos || '').toUpperCase().includes(base)
const slim = (p: any) => ({
  id: p.id, name: p.name, name_zh: p.name_zh, last_name: p.last_name,
  position: p.position, position_zh: p.position_zh, headshot_url: p.headshot_url,
  team: p.team, pts: p.pts, reb: p.reb, ast: p.ast, stl: p.stl, blk: p.blk, min: p.min, salary: p.salary,
})

export default function Lineup() {
  useTabPage('lineup')
  const initSaved = useMemo(() => loadLineup(), [])
  const [slots, setSlots] = useState<Partial<Record<Slot, any>>>(initSaved.slots || {})
  const [locked, setLocked] = useState<boolean>(!!initSaved.locked)
  const [cap, setCap] = useState<number>(() => loadCap())
  const [open, setOpen] = useState<Slot | null>(null)

  const rule = useMemo(() => loadRule(), [])
  const room = useMemo(() => loadRoom(), [])
  const allPlayersQ = useFetch(() => api.allPlayers(), [])
  const games = useFetch(() => api.gamesRange(TODAY, addDays(TODAY, 13)), [])

  useEffect(() => {
    saveLineup({ date: TODAY, locked, slots })
  }, [slots, locked])

  useEffect(() => {
    saveCap(cap)
  }, [cap])

  const pre = (games.data?.games || []).filter((g: any) => (g.state || g.status) === 'pre' || g.status === 'scheduled')
  const night = pre.length ? pre[0].date : null
  const tonight = pre.filter((g: any) => g.date === night)
  const gameDay = night || TODAY

  const picked = SLOTS.map((s) => slots[s.key]).filter(Boolean)
  const spent = picked.reduce((s, p) => s + (Number(p.salary) || 0), 0)
  const remain = cap - spent
  const overCap = spent > cap
  const pctUsed = Math.min(100, Math.round((spent / cap) * 100))

  const estTotalScore = picked.reduce((sum, p) => {
    const box = getPlayerDailyBox(p, gameDay)
    return sum + calcPlayerScore(box, rule).total
  }, 0)

  const handleAutoFill = () => {
    const pool = allPlayersQ.data?.players || []
    if (!pool.length) return
    const auto = buildAutoLineup(pool, cap, 0)
    const slimmed: Partial<Record<Slot, any>> = {}
    LINEUP_SLOTS.forEach((s) => { if (auto[s.key]) slimmed[s.key] = slim(auto[s.key]) })
    setSlots(slimmed)
    setLocked(false)
    Taro.showToast({ title: zh() ? '已按薪资帽智能凑满 5 人' : 'Auto-filled 5 players under cap', icon: 'none' })
  }

  const handleLock = () => {
    if (picked.length < 5) {
      Taro.showToast({ title: zh() ? `请先选满 5 名球员 (${picked.length}/5)` : `Pick 5 players first (${picked.length}/5)`, icon: 'none' })
      return
    }
    if (overCap) {
      Taro.showToast({ title: zh() ? `薪资超出上限 ${money(Math.abs(remain))}，请换人` : `Over cap by ${money(Math.abs(remain))}`, icon: 'none' })
      return
    }
    setLocked(true)
    Taro.showToast({ title: zh() ? '阵容已锁定！可前往 Matchups 查看得分' : 'Lineup locked! Check Matchups', icon: 'none' })
  }

  const share = () => {
    const txt = `${zh() ? '我的今晚阵容' : 'My lineup'} (${gameDay}) · ${money(spent)}\n` +
      SLOTS.map((s) => `${s.base}: ${slots[s.key] ? `${fullName(slots[s.key])} (${money(slots[s.key].salary)})` : '—'}`).join('\n')
    Taro.setClipboardData({ data: txt }).then(() => Taro.showToast({ title: zh() ? '已复制，可粘贴分享' : 'Copied to clipboard', icon: 'none' })).catch(() => {})
  }

  return (
    <View className='page'>
      <View className='lu-h'>
        <View className='lu-top-row'>
          <Text className='lu-title'>{zh() ? <>选择今晚的 <Text className='blue'>5 名球员</Text></> : <>Select <Text className='blue'>5 Players</Text></>}</Text>
          <View className='room-pill' onClick={() => Taro.redirectTo({ url: '/pages/matchups/index' })}>
            <Text className='room-pill-t'>🏀 {room.name} #{room.code}</Text>
          </View>
        </View>
        <Text className='dim small'>
          {picked.length}/5 · {gameDay} · {locked ? (zh() ? '🔒 已锁阵参与今日计分' : '🔒 Locked for scoring') : (zh() ? '赛前可随时调整' : 'Open before tip-off')}
        </Text>
      </View>

      {/* Salary Cap Dashboard */}
      <View className='cap-card card'>
        <View className='cap-row'>
          <View className='row' style={{ gap: '6px' }}>
            <Text className='dim small'>{zh() ? '薪资帽 (Salary Cap)' : 'Salary Cap'}</Text>
            <View className={'cap-badge' + (overCap ? ' over' : picked.length === 5 ? ' ok' : '')}>
              <Text>{overCap ? (zh() ? '超帽' : 'OVER') : picked.length === 5 ? (zh() ? '合规' : 'VALID') : `${picked.length}/5`}</Text>
            </View>
          </View>
          <View className='row' style={{ gap: '6px' }}>
            <View className='cap-step' onClick={() => { setCap((c) => Math.max(130_000_000, c - 10_000_000)); setLocked(false) }}>-</View>
            <Text className='cap-nums'>
              <Text className={overCap ? 'err' : 'bold'}>{spent ? money(spent) : '$0'}</Text>
              <Text className='dim'> / {money(cap)}</Text>
            </Text>
            <View className='cap-step' onClick={() => { setCap((c) => Math.min(240_000_000, c + 10_000_000)); setLocked(false) }}>+</View>
          </View>
        </View>
        <View className='cap-track'>
          <View className={'cap-fill' + (overCap ? ' over' : '')} style={{ width: `${pctUsed}%` }} />
        </View>
        <View className='cap-row' style={{ marginTop: '6px' }}>
          <Text className='dim small'>
            {zh() ? '剩余空间: ' : 'Remaining: '}
            <Text className={overCap ? 'err' : 'orange'}>{overCap ? `-${money(Math.abs(remain))}` : money(remain)}</Text>
          </Text>
          <Text className='dim small'>
            {zh() ? '模拟当日规则分: ' : 'Sim score: '}
            <Text className='blue bold'>{picked.length ? `${estTotalScore.toFixed(1)} 分` : '—'}</Text>
          </Text>
        </View>
      </View>

      {/* Neon Court */}
      <View className='court'>
        <Image className='court-bg' src={asset('/img/court.png')} mode='scaleToFill' />
        {SLOTS.map((s) => {
          const p = slots[s.key]
          return (
            <View key={s.key} className={'slot ' + s.cls} onClick={() => !locked && setOpen(s.key)}>
              <View className={'slot-c' + (p ? ' filled' : '')}>
                {p ? <Img src={headshotOf(p)} size={44} /> : <Text className='slot-plus'>+</Text>}
                {p?.salary ? <Text className='slot-sal'>{`$${(Number(p.salary) / 1e6).toFixed(1)}M`}</Text> : null}
              </View>
              <Text className='slot-l'>{p ? tableName(p) : s.base}</Text>
            </View>
          )
        })}
      </View>

      {/* Action Bar */}
      <View className='lu-actions'>
        {!locked ? (
          <>
            <View className='btn sm ghost' onClick={handleAutoFill}>{zh() ? '⚡ 智能凑满' : '⚡ Auto-fill'}</View>
            <View className={'btn sm primary flex1' + (picked.length === 5 && !overCap ? '' : ' disabled')} onClick={handleLock}>
              {zh() ? `✓ 锁定 5 人阵容 (${picked.length}/5)` : `✓ Lock Lineup (${picked.length}/5)`}
            </View>
            <View className='btn sm ghost' onClick={() => { setSlots({}); setLocked(false) }}>{zh() ? '清空' : 'Clear'}</View>
          </>
        ) : (
          <>
            <View className='btn sm ghost' onClick={() => setLocked(false)}>{zh() ? '解锁修改' : 'Unlock'}</View>
            <View className='btn sm primary flex1' onClick={() => Taro.redirectTo({ url: '/pages/matchups/index' })}>
              {zh() ? '⚡ 查看今日计分 & 好友 PK ›' : '⚡ View Scoring & Friends PK ›'}
            </View>
            <View className='btn sm ghost' onClick={share}>{zh() ? '分享' : 'Share'}</View>
          </>
        )}
      </View>

      {/* Tonight's Games */}
      <View className='lu-sec'>
        <Text className='lu-sec-t'>{zh() ? '今晚比赛' : "Tonight's games"} {night ? <Text className='dim small'>({night} ET)</Text> : null}</Text>
        <Loader loading={games.loading && !games.data} error={games.error} onRetry={games.reload} empty={!games.loading && !tonight.length}>
          <ScrollView scrollX className='tg'>
            {tonight.map((g: any) => (
              <View key={g.id} className='tg-i card' onClick={() => go(`/pages/game/index?id=${g.id}`)}>
                <View className='row'><Img src={logoOf(g.away)} size={18} round={false} /><Text className='tg-n'>{teamName(g.away)}</Text></View>
                <View className='row'><Img src={logoOf(g.home)} size={18} round={false} /><Text className='tg-n'>{teamName(g.home)}</Text></View>
                <Text className='blue small'>{localTime(g.start_time)}</Text>
              </View>
            ))}
          </ScrollView>
        </Loader>
      </View>

      {/* Picked Players */}
      <View className='lu-sec'>
        {picked.map((p) => (
          <PickedCard key={p.id} p={p} locked={locked} onRemove={() => {
            if (locked) return
            setSlots((s) => { const n = { ...s }; (Object.keys(n) as Slot[]).forEach((k) => { if (n[k]?.id === p.id) delete n[k] }); return n })
          }} />
        ))}
        <View className='lu-links'>
          <Text className='blue small' onClick={() => go('/pages/teams/index')}>{t('allTeams')} ›</Text>
          <Text className='dim small'>{zh() ? 'Mock 模拟模式 · 数据流向已打通' : 'Mock flow active'}</Text>
        </View>
      </View>

      {open && (
        <Picker
          slot={open}
          base={SLOTS.find((s) => s.key === open)!.base}
          slots={slots}
          tonight={tonight}
          maxBudget={remain + (Number(slots[open]?.salary) || 0)}
          onClose={() => setOpen(null)}
          onPick={(p) => { setSlots((s) => ({ ...s, [open]: slim(p) })); setLocked(false); setOpen(null) }}
          onRemove={() => { setSlots((s) => { const n = { ...s }; delete n[open]; return n }); setLocked(false); setOpen(null) }}
        />
      )}
      <BottomNav active='lineup' />
    </View>
  )
}

function PickedCard({ p, locked, onRemove }: { p: any; locked: boolean; onRemove: () => void }) {
  return (
    <View className='pc card'>
      <Img src={headshotOf(p)} size={40} />
      <View className='flex1' onClick={() => go(`/pages/player/index?id=${p.id}`)}>
        <Text className='pc-n'>{fullName(p)}</Text>
        <Text className='dim small'>{teamName(p.team)} · {(zh() && p.position_zh) || p.position}</Text>
      </View>
      <Stats p={p} />
      {!locked && <Text className='dim pc-x' onClick={onRemove}>✕</Text>}
    </View>
  )
}

const Stats = ({ p }: { p: any }) => (
  <View className='st'>
    {['pts', 'reb', 'ast'].map((k) => (
      <View key={k} className='st-i'>
        <Text className='st-l'>{k.toUpperCase()}</Text>
        <Text className={'st-v' + (k === 'pts' ? ' blue' : '')}>{p[k] != null ? stat(k, p[k]) : '—'}</Text>
      </View>
    ))}
    <View className='st-i sal'>
      <Text className='st-l'>{zh() ? '薪资' : 'SAL'}</Text>
      <Text className='st-v orange'>{p.salary ? money(p.salary) : '—'}</Text>
    </View>
  </View>
)

function Picker({ slot, base, slots, tonight, maxBudget, onClose, onPick, onRemove }: {
  slot: Slot; base: string; slots: any; tonight: any[]; maxBudget: number;
  onClose: () => void; onPick: (p: any) => void; onRemove: () => void
}) {
  const q = useFetch(() => api.allPlayers(), [])
  const [kw, setKw] = useState('')
  const [pos, setPos] = useState(base)
  const [onlyTonight, setOnlyTonight] = useState(tonight.length > 0)
  const [onlyAffordable, setOnlyAffordable] = useState(false)
  const [team, setTeam] = useState('')
  const tonightTeams = useMemo(() => tonight.flatMap((g: any) => [g.away, g.home]), [tonight])
  const taken = new Set(Object.values(slots).filter(Boolean).map((p: any) => p.id))
  const k = kw.trim().toLowerCase()

  const list = (q.data?.players || []).filter((p: any) =>
    (!pos || fits(p.position, pos)) &&
    (!team || p.team?.abbr === team) &&
    (!onlyTonight || tonightTeams.some((x: any) => x.id === p.team?.id)) &&
    (!onlyAffordable || (Number(p.salary) || 0) <= maxBudget) &&
    (!k || String(p.name).toLowerCase().includes(k) || String(p.name_zh || '').includes(kw.trim())))
    .sort((a: any, b: any) => (b.pts ?? -1) - (a.pts ?? -1)).slice(0, 80)

  return (
    <View className='sheet-mask' onClick={onClose}>
      <View className='sheet' onClick={(e) => e.stopPropagation()}>
        <View className='sheet-h'>
          <View>
            <Text className='bold'>{zh() ? `选择 ${base} 位置球员` : `Pick a ${base}`}</Text>
            <Text className='dim small' style={{ display: 'block' }}>
              {zh() ? `可用预算: ${money(Math.max(0, maxBudget))}` : `Budget: ${money(Math.max(0, maxBudget))}`}
            </Text>
          </View>
          <View className='row' style={{ gap: '12px' }}>
            {slots[slot] && <Text className='orange small' onClick={onRemove}>{zh() ? '移除' : 'Remove'}</Text>}
            <Text className='dim' onClick={onClose}>✕</Text>
          </View>
        </View>
        <Input className='search' placeholder={zh() ? '搜索球员（中/英文）' : 'Search players'} value={kw} onInput={(e) => setKw(e.detail.value)} />
        <ScrollView scrollX className='fchips'>
          {['', 'G', 'F', 'C'].map((x) => (
            <View key={x || 'all'} className={'chip' + (pos === x ? ' on' : '')} onClick={() => setPos(x)}>
              {x || (zh() ? '全部位置' : 'All')}
            </View>
          ))}
          <View className={'chip' + (onlyAffordable ? ' on' : '')} onClick={() => setOnlyAffordable(!onlyAffordable)}>
            {zh() ? '仅看买得起' : 'Affordable'}
          </View>
          {tonight.length > 0 && (
            <View className={'chip' + (onlyTonight ? ' on' : '')} onClick={() => { setOnlyTonight(!onlyTonight); setTeam('') }}>
              {zh() ? '仅今晚比赛' : 'Tonight only'}
            </View>
          )}
          {(onlyTonight ? tonightTeams : []).map((x: any) => (
            <View key={x.id} className={'chip' + (team === x.abbr ? ' on' : '')} onClick={() => setTeam(team === x.abbr ? '' : x.abbr)}>
              {teamName(x)}
            </View>
          ))}
        </ScrollView>
        <ScrollView scrollY className='sheet-list'>
          <Loader loading={q.loading && !q.data} error={q.error} onRetry={q.reload} empty={!q.loading && !list.length}>
            {list.map((p: any) => {
              const over = (Number(p.salary) || 0) > maxBudget && !taken.has(p.id)
              return (
                <View key={p.id} className={'pk card' + (taken.has(p.id) ? ' taken' : '')} onClick={() => !taken.has(p.id) && onPick(p)}>
                  <View className='pk-img'><Img src={headshotOf(p)} size={48} /><Image className='pk-logo' src={logoOf(p.team)} /></View>
                  <View className='flex1'>
                    <View className='row' style={{ gap: '6px' }}>
                      <Text className='pc-n'>{fullName(p)}{p.injury_status ? ' 🚑' : ''}</Text>
                      {over && <Text className='over-tag'>{zh() ? '超预算' : 'Over'}</Text>}
                    </View>
                    <Text className='dim small'>{teamName(p.team)} · {(zh() && p.position_zh) || p.position}{p.gp != null ? ` · ${p.gp}${zh() ? '场' : ' GP'}` : ''}</Text>
                    <Stats p={p} />
                  </View>
                  <View className={'pk-add' + (taken.has(p.id) ? ' done' : '')}>{taken.has(p.id) ? '✓' : '+'}</View>
                </View>
              )
            })}
          </Loader>
        </ScrollView>
      </View>
    </View>
  )
}
