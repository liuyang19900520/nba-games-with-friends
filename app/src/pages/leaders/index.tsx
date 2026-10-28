import { View, Text, ScrollView, Picker } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { t, getLang } from '../../lib/i18n'
import { useFetch, useTabPage, go } from '../../lib/hooks'
import { loadMeta, fallbackMeta } from '../../lib/meta'
import { seasonTypeLabel } from '../../lib/stats'
import { teamName, headshotOf } from '../../lib/teams'
import { num } from '../../lib/fmt'
import { Loader, Seg, Img } from '../../components/ui'
import { LeaderRow, catName } from '../../components/leader'
import BottomNav from '../../components/BottomNav'
import './index.less'

export default function Leaders() {
  useTabPage('leaders')
  const [meta, setMeta] = useState<any>(fallbackMeta)
  useEffect(() => { loadMeta().then(setMeta) }, [])
  const [kind, setKind] = useState('basic')
  const [season, setSeason] = useState(fallbackMeta.current_season)
  const [stype, setStype] = useState(2)
  const [focus, setFocus] = useState('')
  const seasons = meta.seasons || []
  const types: number[] = (seasons.find((s: any) => s.season === season)?.types) || [1, 2, 3]
  useEffect(() => { if (!types.includes(stype)) setStype(types.includes(2) ? 2 : types[0]) }, [season, meta])
  const cats: any[] = meta.leader_categories?.[kind] || []
  const q = useFetch(() => api.leadersAll(season, stype, kind), [season, stype, kind])
  const blocks: any[] = q.data?.categories || []
  const byKey: Record<string, any> = {}
  blocks.forEach((b) => (byKey[b.key] = b))
  return (
    <View className='page lead-page'>
      <View className='filter'>
        <Picker mode='selector' range={seasons.map((s: any) => s.label)} value={Math.max(0, seasons.findIndex((s: any) => s.season === season))}
          onChange={(e) => setSeason(seasons[+e.detail.value].season)}>
          <View className='picker'>{seasons.find((s: any) => s.season === season)?.label} ▾</View>
        </Picker>
        <Picker mode='selector' range={types.map(seasonTypeLabel)} value={Math.max(0, types.indexOf(stype))} onChange={(e) => setStype(types[+e.detail.value])}>
          <View className='picker'>{seasonTypeLabel(stype)} ▾</View>
        </Picker>
        <View className='flex1' />
        <Seg items={[['basic', t('basic')], ['advanced', t('advanced')]]} value={kind} onChange={(k) => { setKind(k); setFocus('') }} />
      </View>
      <View className='lead-body'>
        <ScrollView scrollY className='side'>
          {cats.map((c) => (
            <View key={c.key} className={'side-i' + (focus === c.key ? ' on' : '')} onClick={() => setFocus(c.key)}>{catName(c)}</View>
          ))}
        </ScrollView>
        <ScrollView scrollY className='main' scrollIntoView={focus ? `b-${focus}` : ''} scrollWithAnimation>
          <Loader loading={q.loading && !q.data} error={q.error} onRetry={q.reload} empty={!q.loading && !blocks.length}>
            {cats.filter((c) => byKey[c.key]).map((c) => {
              const b = byKey[c.key]
              return (
                <View key={c.key} id={`b-${c.key}`} className='block card'>
                  <View className='block-h'>
                    <Text className='block-t'>{catName(c)}{getLang() === 'zh' ? '榜' : ''}</Text>
                    <Text className='dim small'>{t('team')}　{t('value')}</Text>
                  </View>
                  {(b.leaders || []).length ? b.leaders.slice(0, 5).map((l: any, i: number) => <LeaderRow key={i} l={l} cat={c.key} />) : <View className='state dim'>{t('empty')}</View>}
                  <View className='more' onClick={() => go(`/pages/leaderlist/index?cat=${c.key}&season=${season}&type=${stype}&name=${encodeURIComponent(catName(c))}`)}>{t('viewAll')} ›</View>
                </View>
              )
            })}
          </Loader>
        </ScrollView>
      </View>
      <BottomNav active='matchups' />
    </View>
  )
}
