import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { t, getLang, useLang } from '../../lib/i18n'
import { useFetch, go } from '../../lib/hooks'
import { teamName, logoOf, teamColor } from '../../lib/teams'
import { localDateTime, num } from '../../lib/fmt'
import { autoCols, seasonTypeLabel, label } from '../../lib/stats'
import { status } from '../../components/game'
import { Loader, Img, Tabs, Table, KV, Section, Seg } from '../../components/ui'
import './index.less'

const BOX = ['min', 'minutes', 'pts', 'reb', 'oreb', 'dreb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta', 'plus_minus']
const ls = (x: any) => (typeof x === 'object' && x ? x.points ?? x.value : x)

export default function Game() {
  const { id } = useRouter().params as any
  const lang = useLang()
  const [tab, setTab] = useState('box')
  const q = useFetch(() => api.game(id), [id])
  const d = q.data || {}
  const g = d.game
  useEffect(() => { if (g) Taro.setNavigationBarTitle({ title: `${teamName(g.away)} vs ${teamName(g.home)}` }) }, [g, lang])
  return (
    <View className='page'>
      <Loader loading={q.loading && !q.data} error={q.error} onRetry={q.reload}>
        {g && <Header g={g} />}
        <Tabs sticky value={tab} onChange={setTab} items={[['box', t('boxscore')], ['compare', t('compare')], ['pbp', t('pbp')], ['info', t('info')]]} />
        {g && tab === 'box' && <Box d={d} />}
        {g && tab === 'compare' && <Compare d={d} />}
        {g && tab === 'pbp' && <Plays d={d} />}
        {g && tab === 'info' && <Info d={d} />}
      </Loader>
    </View>
  )
}

function Header({ g }: { g: any }) {
  const [k, txt] = status(g)
  const hs = g.home?.score ?? g.home_score, as = g.away?.score ?? g.away_score
  const al: any[] = g.away?.linescores || [], hl: any[] = g.home?.linescores || []
  const n = Math.max(al.length, hl.length)
  return (
    <View className='ghead' style={{ background: `linear-gradient(110deg, ${teamColor(g.away)}aa 0%, #0D121D 45%, #0D121D 55%, ${teamColor(g.home)}aa 100%)` }}>
      <View className='gh-type'>{[seasonTypeLabel(g.season_type), localDateTime(g.start_time)].filter(Boolean).join(' · ')}</View>
      <View className='gh-row'>
        <View className='gh-team' onClick={() => go(`/pages/team/index?id=${g.away.id}`)}><Img src={logoOf(g.away)} size={52} round={false} /><Text className='gh-n'>{teamName(g.away)}</Text><Text className='dim small'>{g.away?.record || ''}</Text></View>
        <Text className='gh-s'>{k === 'pre' ? '' : as}</Text>
        <View className='gh-mid'><Text className={'g-st ' + k}>{g.status_detail || txt}</Text>{k === 'live' && g.clock && <Text className='orange small'>{g.clock}</Text>}</View>
        <Text className='gh-s'>{k === 'pre' ? '' : hs}</Text>
        <View className='gh-team' onClick={() => go(`/pages/team/index?id=${g.home.id}`)}><Img src={logoOf(g.home)} size={52} round={false} /><Text className='gh-n'>{teamName(g.home)}</Text><Text className='dim small'>{g.home?.record || ''}</Text></View>
      </View>
      {n > 0 && (
        <View className='qs'>
          <View className='qs-r dim'><Text className='qs-t' />{Array.from({ length: n }, (_, i) => <Text key={i} className='qs-c'>{i < 4 ? `Q${i + 1}` : `OT${i - 3}`}</Text>)}<Text className='qs-c'>{lang() === 'zh' ? '总' : 'T'}</Text></View>
          {[[g.away, al, as], [g.home, hl, hs]].map(([tm, l, s]: any, i) => (
            <View key={i} className='qs-r'><Text className='qs-t'>{tm.abbr}</Text>{Array.from({ length: n }, (_, j) => <Text key={j} className='qs-c'>{ls(l[j]) ?? '-'}</Text>)}<Text className='qs-c bold'>{s}</Text></View>
          ))}
        </View>
      )}
    </View>
  )
}
const lang = getLang

function Box({ d }: { d: any }) {
  const g = d.game
  const [side, setSide] = useState('away')
  const boxes: any[] = d.box || []
  let tb = boxes.find((b) => b.team_id === g[side].id)
  if (!tb && d.players) tb = { players: d.players.filter((p: any) => p.team_id === g[side].id) } // legacy shape
  const ps: any[] = tb?.players || []
  const played = ps.filter((p) => !p.dnp)
  const starters = played.filter((p) => p.starter), bench = played.filter((p) => !p.starter), dnp = ps.filter((p) => p.dnp)
  const cols = autoCols(played.length ? played : ps, BOX).filter((c) => !['starter', 'dnp', 'jersey'].includes(c))
  const nm = (p: any) => (getLang() === 'zh' && p.name_zh) || p.name
  const first = (p: any) => (<><Text className='ell' style={{ maxWidth: '100px' }}>{nm(p)}</Text><Text className='dim small'>{p.position}</Text></>)
  const rows = [...starters, ...(bench.length ? [{ _h: t('bench') }] : []), ...bench]
  const totals = tb?.totals ? [{ ...tb.totals, _t: true }] : []
  return (
    <View className='pad'>
      <View style={{ marginBottom: '8px' }}><Seg items={[['away', teamName(g.away)], ['home', teamName(g.home)]]} value={side} onChange={setSide} /></View>
      <Loader empty={!ps.length}>
        <Text className='dim small'>{t('starters')}</Text>
        <Table rows={[...rows, ...totals]} cols={cols} firstWidth={130} firstHead={t('players')}
          onRow={(p) => p.player_id && go(`/pages/player/index?id=${p.player_id}`)}
          first={(p) => (p._h ? <Text className='blue small'>{p._h}</Text> : p._t ? <Text className='bold'>{getLang() === 'zh' ? '合计' : 'Totals'}</Text> : first(p))} />
        {dnp.length > 0 && (
          <Section title={t('dnp')}>
            <View className='card'>{dnp.map((p) => <View key={p.player_id} className='dnp' onClick={() => go(`/pages/player/index?id=${p.player_id}`)}><Text>{nm(p)}</Text><Text className='dim small'>{p.dnp_reason || 'DNP'}</Text></View>)}</View>
          </Section>
        )}
      </Loader>
    </View>
  )
}

function Compare({ d }: { d: any }) {
  const g = d.game
  const ts: any[] = d.team_stats || []
  const a = ts.find((x) => x.team_id === g.away.id)?.stats || {}, h = ts.find((x) => x.team_id === g.home.id)?.stats || {}
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(h)]))
  const leaders: any[] = d.leaders || []
  return (
    <View>
      <Section title={t('compare')}>
        <Loader empty={!keys.length}>
          <View className='card cmp'>
            <View className='cmp-r head'><Text className='cmp-v'>{teamName(g.away)}</Text><Text className='cmp-k' /><Text className='cmp-v'>{teamName(g.home)}</Text></View>
            {keys.map((k) => {
              const av = parseFloat(a[k]), hv = parseFloat(h[k]); const tot = (av || 0) + (hv || 0)
              return (
                <View key={k} className='cmp-r'>
                  <Text className={'cmp-v' + (av > hv ? ' blue bold' : '')}>{a[k] ?? '-'}</Text>
                  <View className='cmp-k'><Text className='dim small'>{label(k)}</Text>
                    {tot > 0 && !String(a[k]).includes('-') && <View className='bar'><View className='bar-a' style={{ width: `${(av / tot) * 100}%`, background: teamColor(g.away) }} /><View className='bar-h' style={{ width: `${(hv / tot) * 100}%`, background: teamColor(g.home) }} /></View>}
                  </View>
                  <Text className={'cmp-v' + (hv > av ? ' blue bold' : '')}>{h[k] ?? '-'}</Text>
                </View>
              )
            })}
          </View>
        </Loader>
      </Section>
      {leaders.length > 0 && (
        <Section title={getLang() === 'zh' ? '数据王' : 'Leaders'}>
          <View className='card'>{leaders.flatMap((L) => (L.categories || []).map((c: any, i: number) => (
            <View key={L.team_id + '-' + i} className='dnp' onClick={() => c.player_id && go(`/pages/player/index?id=${c.player_id}`)}>
              <Text className='dim small'>{L.team_id === g.home.id ? g.home.abbr : g.away.abbr} · {(getLang() === 'zh' && c.zh) || c.name}</Text>
              <Text>{c.player_name || c.athlete || c.name_player || ''} <Text className='blue bold'>{c.value || c.display}</Text></Text>
            </View>)))}</View>
        </Section>
      )}
    </View>
  )
}

function Plays({ d }: { d: any }) {
  const plays: any[] = d.plays || []
  const periods = Array.from(new Set(plays.map((p) => p.period))).sort((x, y) => x - y)
  const [per, setPer] = useState<number>(periods[0] || 1)
  const g = d.game
  const list = plays.filter((p) => p.period === per).slice().reverse()
  return (
    <View className='pad'>
      <Loader empty={!plays.length}>
        <View style={{ marginBottom: '8px' }}><Seg items={periods.map((p) => [String(p), p <= 4 ? `Q${p}` : `OT${p - 4}`])} value={String(per)} onChange={(k) => setPer(+k)} /></View>
        <View className='card'>
          {list.map((p) => (
            <View key={p.id || p.seq} className={'play' + (p.scoring ? ' scoring' : '')}>
              <Text className='pl-c dim'>{p.clock}</Text>
              <View className='pl-dot' style={{ background: p.team_id ? (p.team_id === g.home.id ? teamColor(g.home) : teamColor(g.away)) : '#333' }} />
              <Text className='flex1 pl-t'>{p.text}</Text>
              <Text className='pl-s'>{p.away_score}-{p.home_score}</Text>
            </View>
          ))}
        </View>
      </Loader>
    </View>
  )
}

function WinProb({ wp, g }: { wp: any[]; g: any }) {
  const step = Math.max(1, Math.ceil(wp.length / 80))
  const pts = wp.filter((_, i) => i % step === 0)
  return (
    <View className='card wp'>
      <View className='wp-l'><Text className='small'>{g.home.abbr} 100%</Text><Text className='small'>{g.away.abbr} 100%</Text></View>
      <View className='wp-c'>
        <View className='wp-mid' />
        {pts.map((p, i) => { const v = Number(p.home_win_pct) - 50; return (
          <View key={i} className='wp-b' style={{ height: `${Math.abs(v)}%`, top: v > 0 ? `${50 - v}%` : '50%', background: v > 0 ? teamColor(g.home) : teamColor(g.away) }} />) })}
      </View>
    </View>
  )
}

function Info({ d }: { d: any }) {
  const g = d.game
  const odds: any[] = Array.isArray(g.odds) ? g.odds : g.odds ? [g.odds] : []
  const zh = getLang() === 'zh'
  return (
    <View>
      <Section title={t('info')}>
        <KV items={[[t('venue'), g.venue && [g.venue.name, g.venue.city, g.venue.state].filter(Boolean).join(', ')], [t('attendance'), g.attendance],
          ['Tip-off', localDateTime(g.start_time)], ['Date (ET)', g.date], ['Status', g.status_detail || g.status], ['Neutral site', g.neutral_site == null ? null : String(g.neutral_site)],
          [zh ? '系列赛' : 'Series', (g.season_series || []).map((s: any) => s.summary).join(' / ')], ['ESPN id', g.id]]} />
      </Section>
      <Section title={t('broadcast')}><KV items={(g.broadcasts || []).map((b: any, i: number) => [typeof b === 'string' ? `#${i + 1}` : `${b.type || ''} ${b.market || ''}`, typeof b === 'string' ? b : b.station])} /></Section>
      <Section title={t('officials')}><KV items={(g.officials || []).map((o: any) => [o.position || 'Official', o.name])} /></Section>
      <Section title={t('odds')}>
        {odds.length ? odds.map((o, i) => <KV key={i} items={[['Provider', o.provider], ['Line', o.details], ['Spread', o.spread], ['O/U', o.over_under], ['Home ML', o.home_moneyline], ['Away ML', o.away_moneyline]]} />) : <Loader empty />}
      </Section>
      <Section title={t('injuries')}>
        <KV items={(d.injuries || []).map((x: any) => [`${x.team_id === g.home.id ? g.home.abbr : g.away.abbr} ${x.name || ''}`, [x.status, x.detail, x.date].filter(Boolean).join(' · ')])} />
      </Section>
      <Section title={t('winprob')}>{(d.win_probability || []).length ? <WinProb wp={d.win_probability} g={g} /> : <Loader empty />}</Section>
    </View>
  )
}
