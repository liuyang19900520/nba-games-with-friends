import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { t, getLang, useLang } from '../../lib/i18n'
import { useFetch, go } from '../../lib/hooks'
import { teamName, teamColor, logoOf, headshotOf } from '../../lib/teams'
import { money, num, stat } from '../../lib/fmt'
import { autoCols, label } from '../../lib/stats'
import { fullName } from '../../lib/names'
import { Loader, Img, Tabs, Table, KV, Section, Seg } from '../../components/ui'
import './index.less'

const BASIC = ['min', 'pts', 'reb', 'oreb', 'dreb', 'ast', 'tov', 'stl', 'blk', 'pf', 'fgm', 'fga', 'fg_pct', 'fg3m_total', 'fg3m', 'fg3a', 'fg3_pct', 'ftm', 'fta', 'ft_pct', 'gp', 'gs']
const fmtStat = stat

function StatGrid({ obj, order }: { obj: any; order: string[] }) {
  const keys = Object.keys(obj || {})
  const sorted = [...order.filter((k) => keys.includes(k)), ...keys.filter((k) => !order.includes(k))]
  if (!sorted.length) return <Loader empty />
  return (
    <View className='sgrid card'>
      {sorted.map((k) => {
        const s = obj[k]; const v = s && typeof s === 'object' ? s.value : s; const r = s && typeof s === 'object' ? s.rank : null
        return (
          <View key={k} className='sg'>
            <Text className='sg-v'>{fmtStat(k, v)}</Text>
            <Text className='sg-l'>{label(k)}</Text>
            {r != null && <Text className='chip-red'>{getLang() === 'zh' ? `联盟第${r}` : `#${r}`}</Text>}
          </View>
        )
      })}
    </View>
  )
}

export default function Player() {
  const { id } = useRouter().params as any
  const lang = useLang()
  const [tab, setTab] = useState('stats')
  const [stype, setStype] = useState('2')
  const base = useFetch(() => api.player(id), [id])
  const cur = base.data?.season
  const q = useFetch(() => (stype === String(base.data?.season_type ?? 2) || !cur ? Promise.resolve(base.data) : api.player(id, cur, +stype)), [id, stype, cur])
  const glog = useFetch(() => (tab === 'games' && cur ? api.gamelog(id, cur, +stype).catch(() => null) : Promise.resolve(null)), [id, tab, stype, cur])
  const d = q.data || base.data || {}
  const p = d.player
  useEffect(() => { if (p) Taro.setNavigationBarTitle({ title: (lang === 'zh' && p.name_zh) || p.name }) }, [p, lang])
  const color = teamColor(p?.team)
  const games: any[] = (glog.data?.game_log || glog.data?.games || d.game_log || []).map((g: any) => ({ ...g, ha: g.home_away === 'home' ? (lang === 'zh' ? '主' : 'H') : (lang === 'zh' ? '客' : 'A') }))
  const seasons: any[] = d.seasons || []
  const inj = p?.injury
  return (
    <View className='page'>
      <Loader loading={base.loading && !base.data} error={base.error} onRetry={base.reload}>
        {p && (
          <View className='phead' style={{ background: `linear-gradient(160deg, ${color} 0%, ${color}bb 50%, #0D121D 100%)` }}>
            <View className='row'>
              <Img src={headshotOf(p)} size={84} className='ph-img' />
              <View className='flex1' style={{ marginLeft: '12px' }}>
                <Text className='ph-name'>{fullName(p)}</Text>
                <Text className='ph-sub'>{p.name}</Text>
                {p.team && <View className='ph-team' onClick={() => go(`/pages/team/index?id=${p.team.id}`)}><Img src={logoOf(p.team)} size={16} round={false} /><Text>{teamName(p.team, true)}</Text></View>}
              </View>
            </View>
            <View className='th-bar'>
              <View className='th-i'><Text className='th-v'>{(lang === 'zh' && p.position_zh) || p.position || '-'}</Text><Text className='th-l'>#{p.jersey ?? '-'}</Text></View>
              <View className='th-i'><Text className='th-v'>{p.age ?? '-'}</Text><Text className='th-l'>{t('age')}</Text></View>
              <View className='th-i'><Text className='th-v'>{p.height_in ? `${Math.round(p.height_in * 2.54)}cm` : p.height || '-'}</Text><Text className='th-l'>{p.height || t('height')}</Text></View>
              <View className='th-i'><Text className='th-v'>{p.weight_lb ? `${Math.round(p.weight_lb * 0.4536)}kg` : p.weight || '-'}</Text><Text className='th-l'>{p.weight || t('weight')}</Text></View>
            </View>
            {inj && <View className='ph-inj'>🚑 {typeof inj === 'string' ? inj : [inj.status_zh && lang === 'zh' ? inj.status_zh : inj.status, inj.type, inj.detail, inj.return_date].filter(Boolean).join(' · ')}</View>}
          </View>
        )}
        <Tabs sticky value={tab} onChange={setTab} items={[['stats', t('stats')], ['games', t('games')], ['info', t('info')]]} />
        {tab !== 'info' && (
          <View className='pad row' style={{ justifyContent: 'space-between' }}>
            <Seg items={[['1', t('preseason')], ['2', t('regular')], ['3', t('postseason')]]} value={stype} onChange={setStype} />
            <Text className='dim small'>{d.season ? `${d.season - 1}-${String(d.season).slice(2)}` : ''}{d.rank_pool ? ` · ${d.rank_pool.qualified ? '' : (lang === 'zh' ? '未达排名门槛 · ' : 'unqualified · ')}${d.rank_pool.players}` : ''}</Text>
          </View>
        )}
        {tab === 'stats' && (
          <Loader loading={q.loading && !q.data} error={q.error} onRetry={q.reload}>
            <Section title={t('basicStats')}><StatGrid obj={d.averages} order={BASIC} /></Section>
            <Section title={t('advStats')}><StatGrid obj={d.advanced} order={['per', 'nba_rating', 'ts_pct', 'efg_pct', 'usage_rate', 'vorp']} /></Section>
            {d.espn_stats && Object.keys(d.espn_stats).map((g) => (
              <Section key={g} title={`ESPN · ${g}`}><StatGrid obj={d.espn_stats[g]} order={[]} /></Section>
            ))}
            <Section title={t('career')}>
              <Table rows={seasons} firstWidth={86} firstHead={t('season')} cols={autoCols(seasons, ['gp', 'gs', 'min', 'pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'fg_pct', 'fg3_pct', 'ft_pct', 'per'])}
                first={(s) => <Text className='small'>{s.label || s.season}{s.season_type && s.season_type !== 2 ? (s.season_type === 3 ? ' PO' : ' PS') : ''} {s.team_abbr || ''}</Text>} />
            </Section>
          </Loader>
        )}
        {tab === 'games' && (
          <View className='pad'>
            <Loader loading={glog.loading} empty={!games.length}>
              <Table rows={games} firstWidth={96} firstHead={t('games')} onRow={(g) => go(`/pages/game/index?id=${g.game_id}`)}
                cols={['ha', 'result', 'score', ...autoCols(games, ['starter', 'min', 'pts', 'reb', 'oreb', 'dreb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta', 'plus_minus'])]}
                first={(g) => <Text className='small'>{String(g.date || '').slice(5)} {g.home_away === 'home' ? 'vs' : '@'} {teamName(g.opponent) || g.opp}</Text>} />
            </Loader>
          </View>
        )}
        {tab === 'info' && p && (
          <View>
            <Section title={t('info')}>
              <KV items={[['Name', p.name], ['中文名', p.name_zh], ['Team', teamName(p.team, true)], ['Position', [p.position, p.position_zh].filter(Boolean).join(' / ')], ['#', p.jersey],
                [t('age'), p.age], ['Birth date', p.birth_date], [t('birthplace'), p.birth_place], [t('height'), p.height], [t('weight'), p.weight], [t('college'), p.college],
                [t('draft'), p.draft?.display || (p.draft ? `${p.draft.year} R${p.draft.round} #${p.draft.pick}` : null)], ['Experience', p.experience], ['Debut', p.debut_year], ['Status', p.status],
                [t('salary'), p.salary ? money(p.salary) : null], [t('injury'), inj ? JSON.stringify(inj) : (lang === 'zh' ? '健康' : 'Healthy')]]} />
            </Section>
            {(p.contracts || p.salary_history) && (
              <Section title={t('salary')}>
                <Table rows={p.contracts || p.salary_history} firstWidth={70} firstHead={t('season')} cols={autoCols(p.contracts || p.salary_history, ['salary'])} first={(r) => <Text>{r.season}</Text>} />
              </Section>
            )}
          </View>
        )}
      </Loader>
    </View>
  )
}
