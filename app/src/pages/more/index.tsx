import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { api } from '../../lib/api'
import { t, setLang, getLang } from '../../lib/i18n'
import { useFetch, useTabPage, go } from '../../lib/hooks'
import { teamName, logoOf, headshotOf } from '../../lib/teams'
import { Loader, Img, Section, Tabs } from '../../components/ui'
import { fullName } from '../../lib/names'
import BottomNav from '../../components/BottomNav'
import './index.less'

export default function More() {
  const lang = useTabPage('more')
  const [tab, setTab] = useState('injuries')
    const inj = useFetch(() => (tab === 'injuries' ? api.injuries() : Promise.resolve(null)), [tab])
  return (
    <View className='page'>
      <View className='topbar'>
        <Text className='h-title'>NBA</Text>
        <View className='picker' onClick={() => setLang(getLang() === 'zh' ? 'en' : 'zh')}>{t('lang')}</View>
      </View>
      <View className='card links'>
        {[['/pages/teams/index', t('allTeams')], ['/pages/standings/index', t('standings')], ['/pages/leaders/index', t('leaders')], ['/pages/index/index', t('schedule')]].map(([u, l]) => (
          <View key={u} className='link' onClick={() => Taro.redirectTo({ url: u })}><Text>{l}</Text><Text className='dim'>›</Text></View>
        ))}
      </View>
      <Tabs items={[['injuries', t('injuries')]]} value={tab} onChange={setTab} />
      {tab === 'injuries' && (
        <Loader loading={inj.loading} error={inj.error} onRetry={inj.reload} empty={!inj.loading && !(inj.data?.teams || []).length}>
          {(inj.data?.teams || []).map((g: any) => (
            <Section key={g.team?.id} title={teamName(g.team, true)}>
              <View className='card'>
                {g.injuries.map((i: any, k: number) => (
                  <View key={k} className='inj' onClick={() => i.player?.id && go(`/pages/player/index?id=${i.player.id}`)}>
                    <Img src={headshotOf(i.player)} size={30} />
                    <View className='flex1'>
                      <Text className='inj-n'>{fullName(i.player)} <Text className='dim'>{i.player?.position}</Text></Text>
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
      <BottomNav active='profile' />
    </View>
  )
}
