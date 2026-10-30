import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import { api } from '../../lib/api'
import { t, getLang } from '../../lib/i18n'
import { useFetch, useTabPage, go } from '../../lib/hooks'
import { teamName, logoOf } from '../../lib/teams'
import { Loader, Img, Seg, Section } from '../../components/ui'
import '../more/index.less'

/** All 30 teams (reached from Leagues → 球队 → 全部球队, Lineup, Profile) by conference / division → team page */
export default function Teams() {
  useTabPage('allTeams')
  const [conf, setConf] = useState('East')
  const q = useFetch(() => api.teams(), [])
  const all: any[] = q.data?.teams || []
  const zh = getLang() === 'zh'
  const divs: Record<string, any[]> = {}
  all.filter((x) => x.conference === conf).forEach((x) => { const k = (zh ? x.division_zh : x.division) || x.division || '-'; (divs[k] = divs[k] || []).push(x) })
  return (
    <View className='page'>
      <View className='topbar'><Seg items={[['East', t('east')], ['West', t('west')]]} value={conf} onChange={setConf} /><Text className='dim small'>{all.length} {zh ? '支球队' : 'teams'}</Text></View>
      <Loader loading={q.loading && !q.data} error={q.error} onRetry={q.reload}>
        {Object.keys(divs).map((d) => (
          <Section key={d} title={d}>
            <View className='grid' style={{ padding: 0 }}>
              {divs[d].sort((a, b) => (a.standing?.conf_rank ?? 99) - (b.standing?.conf_rank ?? 99)).map((tm) => (
                <View key={tm.id} className='cell card' onClick={() => go(`/pages/team/index?id=${tm.id}`)}>
                  <Img src={logoOf(tm)} size={40} round={false} />
                  <Text className='cell-n'>{teamName(tm)}</Text>
                  {tm.standing && <Text className='dim cell-r'>{tm.standing.wins}-{tm.standing.losses} · #{tm.standing.conf_rank}</Text>}
                </View>
              ))}
            </View>
          </Section>
        ))}
      </Loader>
    </View>
  )
}
