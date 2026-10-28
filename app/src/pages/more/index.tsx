import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import { api } from '../../lib/api'
import { t, setLang, getLang } from '../../lib/i18n'
import { useFetch, useTabPage, go } from '../../lib/hooks'
import { teamName, logoOf, headshotOf } from '../../lib/teams'
import { Loader, Img, Section, Tabs } from '../../components/ui'
import './index.less'

export default function More() {
  const lang = useTabPage('more')
  const [tab, setTab] = useState('teams')
  const teams = useFetch(() => api.teams(), [])
  const inj = useFetch(() => (tab === 'injuries' ? api.injuries() : Promise.resolve(null)), [tab])
  return (
    <View className='page'>
      <View className='topbar'>
        <Text className='h-title'>NBA</Text>
        <View className='picker' onClick={() => setLang(getLang() === 'zh' ? 'en' : 'zh')}>{t('lang')}</View>
      </View>
      <Tabs items={[['teams', t('allTeams')], ['injuries', t('injuries')]]} value={tab} onChange={setTab} />
      {tab === 'teams' && (
        <Loader loading={teams.loading} error={teams.error} onRetry={teams.reload}>
          <View className='grid'>
            {(teams.data?.teams || []).map((tm: any) => (
              <View key={tm.id} className='cell card' onClick={() => go(`/pages/team/index?id=${tm.id}`)}>
                <Img src={logoOf(tm)} size={40} round={false} />
                <Text className='ell cell-n'>{teamName(tm)}</Text>
                {tm.standing && <Text className='dim cell-r'>{tm.standing.wins}-{tm.standing.losses}</Text>}
              </View>
            ))}
          </View>
        </Loader>
      )}
      {tab === 'injuries' && (
        <Loader loading={inj.loading} error={inj.error} onRetry={inj.reload} empty={!inj.loading && !(inj.data?.teams || []).length}>
          {(inj.data?.teams || []).map((g: any) => (
            <Section key={g.team?.id} title={teamName(g.team, true)}>
              <View className='card'>
                {g.injuries.map((i: any, k: number) => (
                  <View key={k} className='inj' onClick={() => i.player?.id && go(`/pages/player/index?id=${i.player.id}`)}>
                    <Img src={headshotOf(i.player)} size={30} />
                    <View className='flex1'>
                      <Text className='inj-n'>{(lang === 'zh' && i.player?.name_zh) || i.player?.name} <Text className='dim'>{i.player?.position}</Text></Text>
                      <Text className='dim inj-d'>{[i.type, i.side, i.detail, i.return_date && `→ ${i.return_date}`].filter(Boolean).join(' · ')}</Text>
                      {i.short_comment && <Text className='dim inj-d'>{i.short_comment}</Text>}
                    </View>
                    <Text className='inj-s'>{(lang === 'zh' && i.status_zh) || i.status}</Text>
                  </View>
                ))}
              </View>
            </Section>
          ))}
        </Loader>
      )}
      <View className='dim foot'>{t('about')} · v2 · {process.env.TARO_APP_API_MODE === 'mock' ? (getLang() === 'zh' ? '演示数据（离线快照）' : 'Demo data (offline snapshot)') : `API: ${process.env.TARO_APP_API_BASE}`}</View>
    </View>
  )
}
