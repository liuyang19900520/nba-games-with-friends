import { View, Text, ScrollView } from '@tarojs/components'
import { useMemo, useState } from 'react'
import { useRouter } from '@tarojs/taro'
import { api } from '../../lib/api'
import { t } from '../../lib/i18n'
import { useFetch, useTabPage, go } from '../../lib/hooks'
import { seasonTypeLabel } from '../../lib/stats'
import { addDays, dayLabel, etToday, localTime } from '../../lib/fmt'
import { teamName, logoOf } from '../../lib/teams'
import { Loader, Img } from '../../components/ui'
import { GameCard } from '../../components/game'
import './index.less'

export default function Index() {
  useTabPage('schedule')
  const [date, setDate] = useState((useRouter().params as any).date || process.env.TARO_APP_DEFAULT_DATE || etToday())
  const days = useMemo(() => Array.from({ length: 15 }, (_, i) => addDays(date, i - 7)), [date])
  const q = useFetch(() => api.games(date), [date])
  const games = q.data?.games || []
  return (
    <View className='page'>
      <ScrollView scrollX className='dates' scrollLeft={5 * 70 - 10} scrollWithAnimation>
        {days.map((d) => (
          <View id={`d${d.replace(/-/g, '')}`} key={d} className={'date' + (d === date ? ' on' : '')} onClick={() => setDate(d)}>
            <Text className='date-d'>{d === etToday() ? t('today') : d.slice(5).replace('-', '/')}</Text>
          </View>
        ))}
      </ScrollView>
      <View className='day-h'>
        <Text className='dim' onClick={() => setDate(addDays(date, -1))}>‹</Text>
        <Text>{dayLabel(date)} · {games.length}</Text>
        <Text className='dim' onClick={() => setDate(addDays(date, 1))}>›</Text>
      </View>
      <Loader loading={q.loading && !q.data} error={q.error} onRetry={q.reload}>
        {games.length === 0 ? <View className='state dim'>{t('noGames')}</View> : games.map((g) => <GameCard key={g.id} g={g} />)}
      </Loader>
    </View>
  )
}
