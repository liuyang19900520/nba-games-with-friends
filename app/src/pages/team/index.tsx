import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { t, getLang, useLang } from '../../lib/i18n'
import { useFetch, go } from '../../lib/hooks'
import { teamName, teamColor, logoOf, headshotOf } from '../../lib/teams'
import { localDateTime, money, num, stat } from '../../lib/fmt'
import { autoCols, label } from '../../lib/stats'
import { fullName, tableName, dupeLastNames } from '../../lib/names'
import { Loader, Img, Tabs, Table, KV, Section } from '../../components/ui'
import './index.less'

const wl = (r: any) => (r ? `${r.wins ?? '-'}/${r.losses ?? '-'}` : '-')
const pname = fullName

export default function Team() {
  const { id } = useRouter().params as any
  const lang = useLang()
  const [tab, setTab] = useState('players')
  const q = useFetch(() => api.team(id), [id])
  const tm = q.data?.team
  useEffect(() => { if (tm) Taro.setNavigationBarTitle({ title: teamName(tm, true) }) }, [tm, lang])
  const roster: any[] = (q.data?.roster || []).map((p: any) => ({ ...p, ...(p.averages || {}), salary: p.salary, gp_gs: p.averages?.gp != null ? `${p.averages.gp}/${p.averages.gs ?? 0}` : '-' }))
  const dupes = dupeLastNames(roster)
  roster.sort((a, b) => (b.pts ?? -1) - (a.pts ?? -1))
  const rec = tm?.record || {}
  const st = tm?.standing || {}
  const color = teamColor(tm)
  return (
    <View className='page'>
      <Loader loading={q.loading && !q.data} error={q.error} onRetry={q.reload}>
        {tm && (
          <View className='thead' style={{ background: `linear-gradient(160deg, ${color} 0%, ${color}cc 45%, #0D121D 100%)` }}>
            <View className='row'>
              <Img src={logoOf(tm)} size={64} round={false} />
              <View className='flex1' style={{ marginLeft: '12px' }}>
                <Text className='th-name'>{teamName(tm, true)}</Text>
                <Text className='th-sub'>{tm.name}{tm.venue?.name ? ` · ${tm.venue.name}` : ''}</Text>
                <Text className='th-sub'>{[getLang() === 'zh' ? tm.conference_zh : tm.conference, getLang() === 'zh' ? tm.division_zh : tm.division, tm.standing_summary || st.summary].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>
            <View className='th-bar'>
              <View className='th-i'><Text className='th-v'>{st.conf_rank ?? rec.overall?.playoffSeed ?? '-'}</Text><Text className='th-l'>{(getLang() === 'zh' ? tm.conference_zh : tm.conference) || ''}{t('rank')}</Text></View>
              <View className='th-i'><Text className='th-v'>{wl(rec.overall || st)}</Text><Text className='th-l'>{t('wl')}</Text></View>
              <View className='th-i'><Text className='th-v'>{rec.home ? wl(rec.home) : st.home || '-'}</Text><Text className='th-l'>{t('home')}</Text></View>
              <View className='th-i'><Text className='th-v'>{rec.road ? wl(rec.road) : st.away || '-'}</Text><Text className='th-l'>{t('away')}</Text></View>
            </View>
          </View>
        )}
        <Tabs sticky value={tab} onChange={setTab}
          items={[['players', t('players')], ['schedule', t('schedule')], ['stats', t('stats')], ['salary', t('salary')], ['info', t('info')]]} />
        {tab === 'players' && (
          <View className='pad'>
            {(q.data?.team?.coaches || []).length > 0 && (
              <View className='coaches'>{tm.coaches.map((c: any) => <View key={c.id} className='coach card'><Text>{c.name}</Text><Text className='dim small'>{c.role || 'Coach'}</Text></View>)}</View>
            )}
            <Table rows={roster} firstWidth={124} rowHeight={48} fmt={(k, v) => (k === 'salary' ? money(v) : k === 'gp_gs' ? String(v) : stat(k, v))} firstHead={t('players')}
              cols={['gp_gs', ...autoCols(roster, ['min', 'pts', 'reb', 'oreb', 'dreb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fg_pct', 'fg3_pct', 'ft_pct', 'salary', 'age', 'experience']).filter((c) => c !== 'gp' && c !== 'gs')]}
              onRow={(p) => go(`/pages/player/index?id=${p.id}`)}
              first={(p) => (<>
                <Img src={headshotOf(p)} size={30} />
                <View className='flex1'><Text className='nm' style={{ display: 'block' }}>{tableName(p, dupes)}{p.injury ? ' 🚑' : ''}</Text>
                  <Text className='nm-sub'>{getLang() === 'zh' ? `${p.jersey ?? '-'}号·${p.position_zh || p.position || ''}` : `#${p.jersey ?? '-'} · ${p.position || ''}`}</Text></View>
              </>)} />
          </View>
        )}
        {tab === 'schedule' && (
          <View className='pad'>
            <Loader empty={!(q.data?.schedule || []).length}>
              <View className='card'>
                {(q.data?.schedule || []).map((g: any) => (
                  <View key={g.id} className='sch' onClick={() => go(`/pages/game/index?id=${g.id}`)}>
                    <Text className='dim sch-d'>{localDateTime(g.start_time) || g.date}</Text>
                    <Text className='dim sch-ha'>{g.home_away === 'home' ? 'vs' : '@'}</Text>
                    <Img src={logoOf(g.opponent)} size={20} round={false} />
                    <Text className='flex1 ell'>{teamName(g.opponent)}</Text>
                    {g.result ? <Text className={g.result === 'W' ? 'win' : 'loss'}>{g.result} {g.team_score}-{g.opp_score}</Text> : <Text className='dim'>{g.status_detail || ''}</Text>}
                  </View>
                ))}
              </View>
            </Loader>
          </View>
        )}
        {tab === 'stats' && <TeamStats ts={q.data?.team_stats} rec={rec} />}
        {tab === 'salary' && (
          <View className='pad'>
            <View className='dim small' style={{ marginBottom: '6px' }}>
              {getLang() === 'zh' ? '总薪资（已知）' : 'Total (known)'}: {money(roster.reduce((s, p) => s + (Number(p.salary) || 0), 0))}
            </View>
            <View className='card'>
              {[...roster].sort((a, b) => (b.salary || 0) - (a.salary || 0)).map((p) => (
                <View key={p.id} className='sch' onClick={() => go(`/pages/player/index?id=${p.id}`)}>
                  <Img src={headshotOf(p)} size={26} /><Text className='flex1 ell'>{pname(p)}</Text>
                  <Text className={p.salary ? 'orange bold' : 'dim'}>{p.salary ? money(p.salary) : '-'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {tab === 'info' && tm && (
          <View>
            <Section title={t('info')}>
              <KV items={[['Name', tm.name], ['中文', tm.name_zh], [t('venue'), tm.venue && [tm.venue.name, tm.venue.city, tm.venue.state].filter(Boolean).join(', ')],
                ['Capacity', tm.venue?.capacity], ['Conference', [tm.conference, tm.conference_zh].filter(Boolean).join(' / ')],
                ['Division', [tm.division, tm.division_zh].filter(Boolean).join(' / ')], ['Abbr', tm.abbr], ['Color', tm.color], ['Standing', tm.standing_summary]]} />
            </Section>
            <Section title={t('coaches')}>
              <KV items={(tm.coaches || []).map((c: any) => [c.role || 'Coach', `${c.name}${c.experience != null ? ` (${c.experience}y)` : ''}`])} />
            </Section>
            {q.data?.executives && <Section title='Front office'><KV items={(q.data.executives || []).map((e: any) => [e.role || e.title, e.name])} /></Section>}
            <Section title={getLang() === 'zh' ? '战绩拆分' : 'Record splits'}>
              <KV items={Object.keys(rec).map((k) => [k, wl(rec[k])])} />
            </Section>
          </View>
        )}
      </Loader>
    </View>
  )
}

function TeamStats({ ts, rec }: { ts: any; rec: any }) {
  const s = ts?.stats || {}
  const keys = Object.keys(s)
  const ov = rec?.overall || {}
  const extra = Object.keys(ov).filter((k) => typeof ov[k] === 'number')
  return (
    <View>
      <Section title={label('stats') === 'STATS' ? t('stats') : t('stats')}>
        <Loader empty={!keys.length}>
          <View className='sgrid card'>
            {keys.map((k) => (
              <View key={k} className='sg'>
                <Text className='sg-v'>{s[k]?.display ?? num(s[k]?.value ?? s[k])}</Text>
                <Text className='sg-l'>{label(k)}</Text>
                {s[k]?.rank != null && <Text className='chip-red'>{getLang() === 'zh' ? `联盟第${s[k].rank}` : `#${s[k].rank}`}</Text>}
              </View>
            ))}
          </View>
        </Loader>
      </Section>
      {extra.length > 0 && <Section title='ESPN record stats'><KV items={extra.map((k) => [k, num(ov[k])])} /></Section>}
    </View>
  )
}
