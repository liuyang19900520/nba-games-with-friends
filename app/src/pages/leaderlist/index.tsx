import { View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect } from 'react'
import { api } from '../../lib/api'
import { useFetch } from '../../lib/hooks'
import { seasonLabel } from '../../lib/fmt'
import { seasonTypeLabel } from '../../lib/stats'
import { Loader } from '../../components/ui'
import { LeaderRow } from '../../components/leader'
import '../leaders/index.less'

export default function LeaderList() {
  const { cat = 'pts', season = '2027', type = '2', name = '' } = useRouter().params as any
  useEffect(() => { Taro.setNavigationBarTitle({ title: decodeURIComponent(name) || cat }) }, [])
  const q = useFetch(() => api.leaders(+season, +type, cat), [cat, season, type])
  const rows: any[] = q.data?.leaders || []
  return (
    <View className='page'>
      <View className='filter dim'>{seasonLabel(+season)} {seasonTypeLabel(+type)} · {decodeURIComponent(name)}{q.data?.qualified_min_gp ? ` · GP≥${q.data.qualified_min_gp}` : ''}</View>
      <Loader loading={q.loading && !q.data} error={q.error} onRetry={q.reload} empty={!q.loading && !rows.length}>
        <View className='card block'>{rows.map((l, i) => <LeaderRow key={i} l={l} cat={cat} />)}</View>
      </Loader>
    </View>
  )
}
