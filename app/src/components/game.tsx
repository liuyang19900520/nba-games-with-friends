import { View, Text } from '@tarojs/components'
import { t, getLang } from '../lib/i18n'
import { go } from '../lib/hooks'
import { localTime } from '../lib/fmt'
import { seasonTypeLabel } from '../lib/stats'
import { teamName, logoOf } from '../lib/teams'
import { Img } from './ui'
import './game.less'
export function status(g: any) {
  const s = String(g.state || g.status || '').toLowerCase()
  if (s === 'final' || s === 'post') return ['final', g.status_detail && g.status_detail !== 'Final' ? g.status_detail : t('final')]
  if (s === 'postponed' || s === 'canceled') return ['pre', g.status_detail || s]
  if (s === 'in' || s === 'live' || s === 'in_progress') return ['live', g.status_detail || `${t('live')} Q${g.period || ''}`]
  return ['pre', localTime(g.start_time) || t('scheduled')]
}

export function GameCard({ g }: { g: any }) {
  const [k, txt] = status(g)
  const done = k !== 'pre'
  const hs = g.home?.score ?? g.home_score, as = g.away?.score ?? g.away_score
  const hw = Number(hs) > Number(as), aw = Number(as) > Number(hs)
  return (
    <View className='game card' onClick={() => go(`/pages/game/index?id=${g.id}`)}>
      <View className='g-type dim'><Text className={'g-badge ' + k}>{k === 'pre' ? t('scheduled') : k === 'live' ? t('live') : t('final')}</Text> {seasonTypeLabel(g.season_type)}</View>
      <View className='g-row'>
        <View className='g-team'>
          <Img src={logoOf(g.away)} size={36} round={false} />
          <Text className='g-name ell'>{teamName(g.away)}</Text>
          {g.away?.record && <Text className='dim g-rec'>{g.away.record}</Text>}
        </View>
        <Text className={'g-score' + (done && aw ? ' win' : '')}>{done ? as ?? '-' : ''}</Text>
        <View className='g-mid'>
          <View className={'g-line' + (k === 'pre' ? ' faint' : '')} />
          <Text className={'g-st ' + k}>{txt}</Text>
          <View className={'g-line' + (k === 'pre' ? ' faint' : '')} />
        </View>
        <Text className={'g-score' + (done && hw ? ' win' : '')}>{done ? hs ?? '-' : ''}</Text>
        <View className='g-team'>
          <Img src={logoOf(g.home)} size={36} round={false} />
          <Text className='g-name ell'>{teamName(g.home)}</Text>
          {g.home?.record && <Text className='dim g-rec'>{g.home.record}</Text>}
        </View>
      </View>
      {g.leaders?.home?.pts && (
        <View className='g-foot dim'>{['away', 'home'].map((sd) => { const l = g.leaders[sd]?.pts; return l ? `${(getLang() === 'zh' && l.name_zh) || l.player_name} ${l.value}${getLang() === 'zh' ? '分' : 'pts'}` : '' }).filter(Boolean).join('  |  ')}</View>
      )}
      {(g.venue?.name || g.broadcasts?.length) && <View className='g-foot dim'>{[g.venue?.name, (g.broadcasts || []).map((b: any) => (typeof b === 'string' ? b : b.station)).join('/')].filter(Boolean).join(' · ')}</View>}
    </View>
  )
}

