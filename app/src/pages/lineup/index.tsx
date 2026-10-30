// Lineup (v1 center tab, "pick players to play with friends") — UI-only MVP.
// Same structure as v1 (legacy-v1 LineupPageClient / BasketballCourt / PlayerSearchSection): neon court with 5 slots
// C · F · F · G · G, tap a slot → player picker (search, position, team, tonight's games), "Select 5 players for tonight".
// NO scoring / points / salary cap (Yang: not decided yet). Saved locally (Taro Storage), share = copy text.
import { View, Text, Input, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { api, asset } from '../../lib/api'
import { t, getLang } from '../../lib/i18n'
import { useFetch, useTabPage, go } from '../../lib/hooks'
import { addDays, etToday, localTime, money, stat } from '../../lib/fmt'
import { teamName, logoOf, headshotOf } from '../../lib/teams'
import { fullName, tableName } from '../../lib/names'
import { Loader, Img } from '../../components/ui'
import BottomNav from '../../components/BottomNav'
import './index.less'

type Slot = 'C' | 'F1' | 'F2' | 'G1' | 'G2'
const SLOTS: { key: Slot; base: 'C' | 'F' | 'G'; cls: string }[] = [
  { key: 'C', base: 'C', cls: 's-c' }, { key: 'F1', base: 'F', cls: 's-f1' }, { key: 'F2', base: 'F', cls: 's-f2' },
  { key: 'G1', base: 'G', cls: 's-g1' }, { key: 'G2', base: 'G', cls: 's-g2' },
]
const KEY = 'lineup:v2'
const TODAY = process.env.TARO_APP_DEFAULT_DATE || etToday()
const zh = () => getLang() === 'zh'
const fits = (pos: string, base: string) => String(pos || '').toUpperCase().includes(base)
type Saved = { date: string; slots: Partial<Record<Slot, any>> }
const slim = (p: any) => ({ id: p.id, name: p.name, name_zh: p.name_zh, last_name: p.last_name, position: p.position, position_zh: p.position_zh, headshot_url: p.headshot_url, team: p.team, pts: p.pts, reb: p.reb, ast: p.ast, salary: p.salary })

export default function Lineup() {
  useTabPage('lineup')
  const [slots, setSlots] = useState<Saved['slots']>(() => { try { return (Taro.getStorageSync(KEY) || {}).slots || {} } catch (e) { return {} } })
  useEffect(() => { Taro.setStorageSync(KEY, { date: TODAY, slots }) }, [slots])
  const [open, setOpen] = useState<Slot | null>(null)
  const games = useFetch(() => api.gamesRange(TODAY, addDays(TODAY, 13)), [])
  // "tonight" = first ET game day >= today with games not yet started
  const pre = (games.data?.games || []).filter((g: any) => (g.state || g.status) === 'pre' || g.status === 'scheduled')
  const night = pre.length ? pre[0].date : null
  const tonight = pre.filter((g: any) => g.date === night)
  const picked = SLOTS.map((s) => slots[s.key]).filter(Boolean)
  const total = picked.reduce((s, p) => s + (Number(p.salary) || 0), 0)
  const share = () => {
    const txt = `${zh() ? '我的今晚阵容' : 'My lineup for tonight'} (${night || TODAY})\n` + SLOTS.map((s) => `${s.base}: ${slots[s.key] ? `${fullName(slots[s.key])} (${slots[s.key].team?.abbr || ''})` : '—'}`).join('\n')
    Taro.setClipboardData({ data: txt }).then(() => Taro.showToast({ title: zh() ? '已复制，可粘贴分享' : 'Copied to clipboard', icon: 'none' })).catch(() => {})
  }
  return (
    <View className='page'>
      <View className='lu-h'>
        <Text className='lu-title'>{zh() ? <>选择今晚的 <Text className='blue'>5 名球员</Text></> : <>Select <Text className='blue'>5 Players</Text> for Tonight</>}</Text>
        <Text className='dim small'>{picked.length}/5 · {night ? `${zh() ? '比赛日' : 'Game day'} ${night}` : ''}</Text>
      </View>
      <View className='court'>
        <Image className='court-bg' src={asset('/img/court.png')} mode='scaleToFill' />
        {SLOTS.map((s) => {
          const p = slots[s.key]
          return (
            <View key={s.key} className={'slot ' + s.cls} onClick={() => setOpen(s.key)}>
              <View className={'slot-c' + (p ? ' filled' : '')}>{p ? <Img src={headshotOf(p)} size={44} /> : <Text className='slot-plus'>+</Text>}</View>
              <Text className='slot-l'>{p ? tableName(p) : s.base}</Text>
            </View>
          )
        })}
      </View>
      <View className='lu-bar'>
        <Text className='dim small'>{zh() ? '总薪资（仅展示）' : 'Total salary (info only)'}: {total ? money(total) : '—'}</Text>
        <View className='row' style={{ gap: '8px' }}>
          <View className='btn sm' onClick={share}>{zh() ? '分享' : 'Share'}</View>
          <View className='btn sm ghost' onClick={() => setSlots({})}>{zh() ? '清空' : 'Clear'}</View>
        </View>
      </View>
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
      <View className='lu-sec'>
        {picked.map((p) => <PickedCard key={p.id} p={p} onRemove={() => setSlots((s) => { const n = { ...s }; (Object.keys(n) as Slot[]).forEach((k) => { if (n[k]?.id === p.id) delete n[k] }); return n })} />)}
        <View className='lu-links'>
          <Text className='blue small' onClick={() => go('/pages/teams/index')}>{t('allTeams')} ›</Text>
          <Text className='dim small'>{zh() ? '仅界面演示：暂无计分/房间/账号' : 'UI demo: no scoring / rooms / accounts yet'}</Text>
        </View>
      </View>
      {open && <Picker slot={open} base={SLOTS.find((s) => s.key === open)!.base} slots={slots} tonight={tonight}
        onClose={() => setOpen(null)} onPick={(p) => { setSlots((s) => ({ ...s, [open]: slim(p) })); setOpen(null) }}
        onRemove={() => { setSlots((s) => { const n = { ...s }; delete n[open]; return n }); setOpen(null) }} />}
      <BottomNav active='lineup' />
    </View>
  )
}

function PickedCard({ p, onRemove }: { p: any; onRemove: () => void }) {
  return (
    <View className='pc card'>
      <Img src={headshotOf(p)} size={40} />
      <View className='flex1' onClick={() => go(`/pages/player/index?id=${p.id}`)}>
        <Text className='pc-n'>{fullName(p)}</Text>
        <Text className='dim small'>{teamName(p.team)} · {(zh() && p.position_zh) || p.position}</Text>
      </View>
      <Stats p={p} />
      <Text className='dim pc-x' onClick={onRemove}>✕</Text>
    </View>
  )
}
const Stats = ({ p }: { p: any }) => (
  <View className='st'>
    {['pts', 'reb', 'ast'].map((k) => <View key={k} className='st-i'><Text className='st-l'>{k.toUpperCase()}</Text><Text className={'st-v' + (k === 'pts' ? ' blue' : '')}>{p[k] != null ? stat(k, p[k]) : '—'}</Text></View>)}
    <View className='st-i sal'><Text className='st-l'>{zh() ? '薪资' : 'SAL'}</Text><Text className='st-v'>{p.salary ? money(p.salary) : '—'}</Text></View>
  </View>
)

function Picker({ slot, base, slots, tonight, onClose, onPick, onRemove }: { slot: Slot; base: string; slots: any; tonight: any[]; onClose: () => void; onPick: (p: any) => void; onRemove: () => void }) {
  const q = useFetch(() => api.allPlayers(), [])
  const [kw, setKw] = useState('')
  const [pos, setPos] = useState(base)
  const [onlyTonight, setOnlyTonight] = useState(tonight.length > 0)
  const [team, setTeam] = useState('')
  const tonightTeams = useMemo(() => tonight.flatMap((g: any) => [g.away, g.home]), [tonight])
  const taken = new Set(Object.values(slots).filter(Boolean).map((p: any) => p.id))
  const k = kw.trim().toLowerCase()
  const list = (q.data?.players || []).filter((p: any) =>
    (!pos || fits(p.position, pos)) && (!team || p.team?.abbr === team) &&
    (!onlyTonight || tonightTeams.some((x: any) => x.id === p.team?.id)) &&
    (!k || String(p.name).toLowerCase().includes(k) || String(p.name_zh || '').includes(kw.trim())))
    .sort((a: any, b: any) => (b.pts ?? -1) - (a.pts ?? -1)).slice(0, 80)
  return (
    <View className='sheet-mask' onClick={onClose}>
      <View className='sheet' onClick={(e) => e.stopPropagation()}>
        <View className='sheet-h'>
          <Text className='bold'>{zh() ? `选择 ${base} 位置球员` : `Pick a ${base}`}</Text>
          <View className='row' style={{ gap: '12px' }}>{slots[slot] && <Text className='orange small' onClick={onRemove}>{zh() ? '移除' : 'Remove'}</Text>}<Text className='dim' onClick={onClose}>✕</Text></View>
        </View>
        <Input className='search' placeholder={zh() ? '搜索球员（中/英文）' : 'Search players'} value={kw} onInput={(e) => setKw(e.detail.value)} />
        <ScrollView scrollX className='fchips'>
          {['', 'G', 'F', 'C'].map((x) => <View key={x || 'all'} className={'chip' + (pos === x ? ' on' : '')} onClick={() => setPos(x)}>{x || (zh() ? '全部位置' : 'All')}</View>)}
          {tonight.length > 0 && <View className={'chip' + (onlyTonight ? ' on' : '')} onClick={() => { setOnlyTonight(!onlyTonight); setTeam('') }}>{zh() ? '仅今晚比赛' : 'Tonight only'}</View>}
          {(onlyTonight ? tonightTeams : []).map((x: any) => <View key={x.id} className={'chip' + (team === x.abbr ? ' on' : '')} onClick={() => setTeam(team === x.abbr ? '' : x.abbr)}>{teamName(x)}</View>)}
        </ScrollView>
        <ScrollView scrollY className='sheet-list'>
          <Loader loading={q.loading && !q.data} error={q.error} onRetry={q.reload} empty={!q.loading && !list.length}>
            {list.map((p: any) => (
              <View key={p.id} className={'pk card' + (taken.has(p.id) ? ' taken' : '')} onClick={() => !taken.has(p.id) && onPick(p)}>
                <View className='pk-img'><Img src={headshotOf(p)} size={48} /><Image className='pk-logo' src={logoOf(p.team)} /></View>
                <View className='flex1'>
                  <Text className='pc-n'>{fullName(p)}{p.injury_status ? ' 🚑' : ''}</Text>
                  <Text className='dim small'>{teamName(p.team)} · {(zh() && p.position_zh) || p.position}{p.gp != null ? ` · ${p.gp}${zh() ? '场' : ' GP'}` : ''}</Text>
                  <Stats p={p} />
                </View>
                <View className={'pk-add' + (taken.has(p.id) ? ' done' : '')}>{taken.has(p.id) ? '✓' : '+'}</View>
              </View>
            ))}
          </Loader>
        </ScrollView>
      </View>
    </View>
  )
}
