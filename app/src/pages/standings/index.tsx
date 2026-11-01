// Leagues tab: team standings/stat ranks and player leaders.
//   球队: one filter row (East / West / divisions / team stats), standings by default
//   球员: shared player leaderboard.
import { View, Text, ScrollView, Button } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { t, getLang } from '../../lib/i18n'
import { useFetch, useTabPage, go } from '../../lib/hooks'
import { teamName, logoOf } from '../../lib/teams'
import { stat } from '../../lib/fmt'
import { loadMeta, fallbackMeta } from '../../lib/meta'
import { Loader, Img, Table, Seg } from '../../components/ui'
import PlayerLeaders from '../../components/PlayerLeaders'
import BottomNav from '../../components/BottomNav'
import './index.less'

const COLS = ['wins', 'losses', 'win_pct', 'games_behind', 'home', 'away', 'conf', 'div', 'last10', 'streak', 'ppg', 'opp_ppg', 'diff', 'seed']
const zh = () => getLang() === 'zh'

function Chips({ items, value, onChange }: { items: [string, string][]; value: string; onChange: (k: string) => void }) {
  return (
    <ScrollView scrollX className='chips'>
      {items.map(([k, l]) => <Button key={k} className={'chip' + (k === value ? ' on' : '')} ariaLabel={l} onClick={() => onChange(k)}>{l}</Button>)}
    </ScrollView>
  )
}

function TeamStandings({ filter }: { filter: string }) {
  const q = useFetch(() => api.standings(), [])
  const tl = useFetch(() => api.teams(), [])
  const div: Record<number, string> = {}
  ;(tl.data?.teams || []).forEach((x: any) => (div[x.id] = (zh() ? x.division_zh : x.division) || x.division))
  const conferences = (q.data?.conferences || []).filter((x: any) => filter === 'div' || x.abbr === filter)
  const normalize = (teams: any[]) => teams.map((r: any) => ({ ...r, win_pct: r.win_pct != null ? +(r.win_pct * (r.win_pct <= 1 ? 100 : 1)).toFixed(1) : null }))
  const rows = conferences.flatMap((c: any) => normalize(c.teams || []))
  const groups: [string, any[]][] = filter !== 'div' ? [['', rows]] : conferences.flatMap((c: any) => {
    const conference = c.abbr === 'East' ? t('east') : t('west')
    return Object.entries(normalize(c.teams || []).reduce((m: Record<string, any[]>, r: any) => {
      const name = `${conference} · ${div[r.team.id] || (zh() ? '其他赛区' : 'Other division')}`
      ;(m[name] = m[name] || []).push(r)
      return m
    }, {}))
  })
  const cols = COLS.filter((k) => rows.some((r: any) => r[k] != null))
  return (
    <View>
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
        <View className='note dim'>{filter === 'div' && (zh() ? '名次为东/西部排名 · ' : 'Ranks within each conference · ')}{zh() ? '蓝色 1-6 直接晋级季后赛 · 橙色 7-10 附加赛' : 'Blue 1-6 playoffs · Orange 7-10 play-in'}</View>
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

export default function Leagues() {
  useTabPage('standings')
  const [meta, setMeta] = useState<any>(fallbackMeta)
  useEffect(() => { loadMeta().then(setMeta) }, [])
  const [top, setTop] = useState('teams')
  const [teamView, setTeamView] = useState('East')
  const season = meta.current_season || 2027
  return (
    <View className={'page league-page' + (top === 'players' ? ' league-players' : '')}>
      <View className='topbar'>
        <Seg items={[['teams', zh() ? '球队' : 'Teams'], ['players', zh() ? '球员' : 'Players']]} value={top} onChange={setTop} />
        {top === 'teams' && <Text className='dim small'>{season - 1}-{String(season).slice(2)} {zh() ? '常规赛' : 'Regular'}</Text>}
      </View>
      {top === 'teams' && (
        <View>
          <View className='team-filters'>
            {[
              ['East', t('east')], ['West', t('west')],
              ['div', zh() ? '赛区' : 'Divisions'], ['stats', zh() ? '数据榜' : 'Team stats'],
            ].map(([key, label]) => (
              <Button key={key} className={'chip' + (key === teamView ? ' on' : '')} ariaLabel={label} onClick={() => setTeamView(key)}>{label}</Button>
            ))}
          </View>
          <View className='team-context'>
            <Text className='team-context-label dim small'>{teamView === 'stats' ? (zh() ? '球队数据榜' : 'Team stat leaders') : teamView === 'div' ? (zh() ? '按赛区分组 · 东/西部排名' : 'By division · conference ranks') : `${teamView === 'East' ? t('east') : t('west')} ${zh() ? '排名' : 'standings'}`}</Text>
            <Button className='teams-link' onClick={() => go('/pages/teams/index')}>{t('allTeams')} ›</Button>
          </View>
          {teamView === 'stats' ? <TeamStatRanks season={season} /> : <TeamStandings filter={teamView} />}
        </View>
      )}
      {top === 'players' && <PlayerLeaders />}
      <BottomNav active='leagues' />
    </View>
  )
}
