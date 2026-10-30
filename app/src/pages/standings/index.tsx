// Leagues tab: ONE page for team AND player rankings (v1 "Leagues" + Hupu 数据 tab).
//   球队: 排名 (conference / division standings) · 数据榜 (team stat category chips → ranked list)
//   球员: 基础/进阶 category chips → top 10 (LeaderRow) → 查看全部 (pages/leaderlist)
import { View, Text, ScrollView } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { t, getLang } from '../../lib/i18n'
import { useFetch, useTabPage, go } from '../../lib/hooks'
import { teamName, logoOf } from '../../lib/teams'
import { stat } from '../../lib/fmt'
import { loadMeta, fallbackMeta } from '../../lib/meta'
import { Loader, Img, Table, Seg } from '../../components/ui'
import { LeaderRow, catName } from '../../components/leader'
import BottomNav from '../../components/BottomNav'
import './index.less'

const COLS = ['wins', 'losses', 'win_pct', 'games_behind', 'home', 'away', 'conf', 'div', 'last10', 'streak', 'ppg', 'opp_ppg', 'diff', 'seed']
const zh = () => getLang() === 'zh'

function Chips({ items, value, onChange }: { items: [string, string][]; value: string; onChange: (k: string) => void }) {
  return (
    <ScrollView scrollX className='chips'>
      {items.map(([k, l]) => <View key={k} className={'chip' + (k === value ? ' on' : '')} onClick={() => onChange(k)}>{l}</View>)}
    </ScrollView>
  )
}

function TeamStandings() {
  const [conf, setConf] = useState('East')
  const [by, setBy] = useState('conf')
  const q = useFetch(() => api.standings(), [])
  const tl = useFetch(() => api.teams(), [])
  const div: Record<number, string> = {}
  ;(tl.data?.teams || []).forEach((x: any) => (div[x.id] = (zh() ? x.division_zh : x.division) || x.division))
  const c = (q.data?.conferences || []).find((x: any) => x.abbr === conf)
  const rows = (c?.teams || []).map((r: any) => ({ ...r, win_pct: r.win_pct != null ? +(r.win_pct * (r.win_pct <= 1 ? 100 : 1)).toFixed(1) : null }))
  const groups: [string, any[]][] = by === 'conf' ? [['', rows]] : Object.entries(rows.reduce((m: any, r: any) => { const k = div[r.team.id] || '-'; (m[k] = m[k] || []).push(r); return m }, {}))
  const cols = COLS.filter((k) => rows.some((r: any) => r[k] != null))
  return (
    <View>
      <View className='bar2'>
        <Seg items={[['East', t('east')], ['West', t('west')]]} value={conf} onChange={setConf} />
        <Seg items={[['conf', zh() ? '分区' : 'Conf'], ['div', zh() ? '赛区' : 'Division']]} value={by} onChange={setBy} />
      </View>
      <Loader loading={q.loading && !q.data} error={q.error} onRetry={q.reload} empty={!q.loading && !rows.length}>
        {groups.map(([g, rs]) => (
          <View key={g} className='grp'>
            {g && <Text className='grp-t'>{g}</Text>}
            <Table rows={rs} cols={cols} firstWidth={124} firstHead={t('team')} onRow={(r) => go(`/pages/team/index?id=${r.team.id}`)}
              first={(r) => (<>
                <Text className={r.rank <= 6 ? 'blue bold' : r.rank <= 10 ? 'orange bold' : 'dim'} style={{ width: '18px' }}>{r.rank}</Text>
                <Img src={logoOf(r.team)} size={22} round={false} />
                <Text className='nm'>{teamName(r.team)}</Text>
              </>)} />
          </View>
        ))}
        <View className='note dim'>{zh() ? '蓝色 1-6 直接晋级季后赛 · 橙色 7-10 附加赛' : 'Blue 1-6 playoffs · Orange 7-10 play-in'}</View>
      </Loader>
    </View>
  )
}

function TeamStatRanks({ season }: { season: number }) {
  const q = useFetch(() => api.teamStats(season), [season])
  const cats: any[] = q.data?.categories || []
  const [cat, setCat] = useState('pts')
  const c = cats.find((x) => x.key === cat) || cats[0]
  const rows = (c?.teams || []).map((r: any) => ({ ...r, [c.key]: r.value }))
  return (
    <Loader loading={q.loading && !q.data} error={q.error} onRetry={q.reload} empty={!q.loading && !cats.length}>
      <Chips items={cats.map((x) => [x.key, zh() ? x.zh : x.en])} value={c?.key} onChange={setCat} />
      {c && (
        <View className='grp'>
          <Table rows={rows} cols={[c.key, 'gp']} firstWidth={200} firstHead={t('team')} fmt={(k, v) => stat(k, v)} onRow={(r) => go(`/pages/team/index?id=${r.team.id}`)}
            first={(r) => (<>
              <Text className={r.rank <= 3 ? 'orange bold' : 'dim'} style={{ width: '20px' }}>{r.rank}</Text>
              <Img src={logoOf(r.team)} size={22} round={false} />
              <Text className='nm'>{teamName(r.team, true)}</Text>
            </>)} />
          <View className='note dim'>{c.order === 'asc' ? (zh() ? '数值越低排名越高 · ' : 'lower is better · ') : ''}{zh() ? '场均，来自比赛数据' : 'per game, from box scores'}</View>
        </View>
      )}
    </Loader>
  )
}

function PlayerRanks({ meta, season, stype }: { meta: any; season: number; stype: number }) {
  const [kind, setKind] = useState('basic')
  const cats: any[] = meta.leader_categories?.[kind] || []
  const [cat, setCat] = useState('pts')
  useEffect(() => { if (!cats.some((c) => c.key === cat)) setCat(cats[0]?.key) }, [kind, meta])
  const c = cats.find((x) => x.key === cat) || cats[0]
  const q = useFetch(() => (c ? api.leaders(season, stype, c.key) : Promise.resolve(null)), [c?.key, season, stype])
  const rows: any[] = (q.data?.leaders || []).slice(0, 10)
  return (
    <View>
      <View className='bar2'><Seg items={[['basic', t('basic')], ['advanced', t('advanced')]]} value={kind} onChange={setKind} /></View>
      <Chips items={cats.map((x) => [x.key, catName(x)])} value={c?.key} onChange={setCat} />
      <Loader loading={q.loading && !q.data} error={q.error} onRetry={q.reload} empty={!q.loading && !rows.length}>
        <View className='card blockp'>
          <View className='blockp-h'><Text className='bold'>{c && catName(c)}{zh() ? '榜' : ''}</Text><Text className='dim small'>{t('team')}　{t('value')}</Text></View>
          {rows.map((l, i) => <LeaderRow key={i} l={l} cat={c.key} />)}
          <View className='more' onClick={() => go(`/pages/leaderlist/index?cat=${c.key}&season=${season}&type=${stype}&name=${encodeURIComponent(catName(c))}`)}>{t('viewAll')} ›</View>
        </View>
      </Loader>
    </View>
  )
}

export default function Leagues() {
  useTabPage('standings')
  const [meta, setMeta] = useState<any>(fallbackMeta)
  useEffect(() => { loadMeta().then(setMeta) }, [])
  const [top, setTop] = useState('teams')
  const [teamView, setTeamView] = useState('standings')
  const season = meta.current_season || 2027
  return (
    <View className='page'>
      <View className='topbar'>
        <Seg items={[['teams', zh() ? '球队' : 'Teams'], ['players', zh() ? '球员' : 'Players']]} value={top} onChange={setTop} />
        <Text className='dim small'>{season - 1}-{String(season).slice(2)} {zh() ? '常规赛' : 'Regular'}</Text>
      </View>
      {top === 'teams' && (
        <View>
          <View className='bar2'>
            <Seg items={[['standings', zh() ? '排名' : 'Standings'], ['stats', zh() ? '数据榜' : 'Team stats']]} value={teamView} onChange={setTeamView} />
            <Text className='blue small' onClick={() => go('/pages/teams/index')}>{t('allTeams')} ›</Text>
          </View>
          {teamView === 'standings' ? <TeamStandings /> : <TeamStatRanks season={season} />}
        </View>
      )}
      {top === 'players' && <PlayerRanks meta={meta} season={season} stype={2} />}
      <BottomNav active='leagues' />
    </View>
  )
}
