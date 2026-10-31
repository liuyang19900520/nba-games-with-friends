import { View, Text, Picker } from '@tarojs/components'
import { useState } from 'react'
import { api } from '../lib/api'
import { t } from '../lib/i18n'
import { useFetch } from '../lib/hooks'
import { addDays, dayLabel, etToday, ymd } from '../lib/fmt'
import { Loader, Seg } from './ui'
import { GameCard, status } from './game'
import './Schedule.less'

/** "today" of the data: mock world date in mock mode, else US-Eastern today */
const TODAY = process.env.TARO_APP_DEFAULT_DATE || etToday()
const UPCOMING_DAYS = 14, RECENT_DAYS = 7
/** group by the user's LOCAL calendar day of tip-off (falls back to ET date) */
const localDay = (g: any) => (g.start_time ? ymd(new Date(g.start_time)) : g.date)

type ScheduleProps = { initialDate?: string }

export default function Schedule({ initialDate }: ScheduleProps) {
  const [mode, setMode] = useState<'upcoming' | 'results' | 'day'>(initialDate ? 'day' : 'upcoming')
  const [day, setDay] = useState<string>(initialDate || TODAY)
  const q = useFetch(() => (mode === 'upcoming' ? api.gamesRange(TODAY, addDays(TODAY, UPCOMING_DAYS - 1))
    : mode === 'results' ? api.gamesRange(addDays(TODAY, -RECENT_DAYS), addDays(TODAY, -1)) : api.games(day)), [mode, day])
  let games: any[] = q.data?.games || []
  if (mode === 'results') games = games.filter((g) => status(g)[0] !== 'pre').reverse()
  const live = mode === 'upcoming' ? games.filter((g) => status(g)[0] === 'live') : []
  const rest = games.filter((g) => !live.includes(g))
  const groups: [string, any[]][] = []
  rest.forEach((g) => { const d = localDay(g); const last = groups[groups.length - 1]; if (last && last[0] === d) last[1].push(g); else groups.push([d, [g]]) })
  const today = ymd(new Date())
  const head = (d: string) => (d === today ? `${t('today')} · ` : d === addDays(today, 1) ? `${t('tomorrow')} · ` : '') + dayLabel(d)
  return (
    <View className='schedule'>
      <View className='home-top'>
        <Seg items={[[ 'upcoming', t('upcoming') ], [ 'results', t('results') ]]} value={mode === 'day' ? '' : mode} onChange={(k: any) => setMode(k)} />
        <Picker mode='date' value={day} onChange={(e) => { setDay(e.detail.value); setMode('day') }}>
          <View className={'picker' + (mode === 'day' ? ' on' : '')}>📅 {mode === 'day' ? day.slice(5).replace('-', '/') : t('pickDate')}</View>
        </Picker>
      </View>
      <View className='tz dim'>{t('localTz')}</View>
      <Loader loading={q.loading && !q.data} error={q.error} onRetry={q.reload}>
        {live.length > 0 && (
          <View><View className='day-h live'><Text>● {t('liveNow')}</Text><Text>{live.length}</Text></View>{live.map((g) => <GameCard key={g.id} g={g} />)}</View>
        )}
        {games.length === 0 && <View className='state dim'>{t('noGames')}</View>}
        {groups.map(([d, gs]) => (
          <View key={d}>
            <View className='day-h'><Text>{head(d)}</Text><Text className='dim'>{gs.length} {t('nGames')}</Text></View>
            {gs.map((g) => <GameCard key={g.id} g={g} />)}
          </View>
        ))}
        {mode !== 'day' && <View className='more-link dim' onClick={() => setMode(mode === 'upcoming' ? 'results' : 'upcoming')}>{mode === 'upcoming' ? `${t('results')} ›` : `${t('upcoming')} ›`}</View>}
      </Loader>
    </View>
  )
}
