import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { useTabPage } from '../../lib/hooks'
import { getLang } from '../../lib/i18n'
import { etToday, money } from '../../lib/fmt'
import { headshotOf } from '../../lib/teams'
import { LINEUP_SLOTS, loadLineup, loadCap, loadRule, loadRoom, getPlayerDailyBox, calcPlayerScore } from '../../lib/scoring'
import { Img } from '../../components/ui'
import Schedule from '../../components/Schedule'
import BottomNav from '../../components/BottomNav'
import './index.less'

const TODAY = process.env.TARO_APP_DEFAULT_DATE || etToday()
const zh = () => getLang() === 'zh'

export default function Index() {
  useTabPage('schedule')
  const params = useRouter().params as any
  const [saved, setSaved] = useState(() => loadLineup())
  const [cap, setCap] = useState(() => loadCap())
  const [rule, setRule] = useState(() => loadRule())
  const [room, setRoom] = useState(() => loadRoom())

  useDidShow(() => {
    setSaved(loadLineup())
    setCap(loadCap())
    setRule(loadRule())
    setRoom(loadRoom())
  })

  const picked = useMemo(() => LINEUP_SLOTS.map((s) => saved.slots?.[s.key]).filter(Boolean), [saved])
  const spent = picked.reduce((s, p) => s + (Number(p?.salary) || 0), 0)
  const gameDay = saved.date || TODAY
  const simScore = picked.reduce((s, p) => s + calcPlayerScore(getPlayerDailyBox(p, gameDay), rule).total, 0)

  return (
    <View className='page'>
      {/* Brand + Today's Lineup Quick Status Banner */}
      <View className='home-hero'>
        <View className='home-brand-row'>
          <View>
            <Text className='home-brand'>NBA <Text className='blue'>FRIENDS</Text></Text>
            <Text className='dim small' style={{ display: 'block' }}>{zh() ? '每日薪资选5人 · 技术统计比高低' : 'Daily 5-Player Salary Cap & Friends PK'}</Text>
          </View>
          <View className='home-room-chip' onClick={() => Taro.redirectTo({ url: '/pages/matchups/index' })}>
            <Text>🏀 #{room.code}</Text>
          </View>
        </View>

        <View className='home-status-card card'>
          {picked.length > 0 ? (
            <View className='row' style={{ justifyContent: 'space-between', gap: '10px' }}>
              <View className='flex1'>
                <View className='row' style={{ gap: '6px', marginBottom: '6px' }}>
                  <Text className='status-dot'>{saved.locked ? (zh() ? '🔒 已锁阵' : '🔒 Locked') : (zh() ? '📝 待锁阵' : '📝 Draft')}</Text>
                  <Text className='dim small'>{picked.length}/5 · {money(spent)} / {money(cap)}</Text>
                </View>
                <View className='row' style={{ gap: '4px' }}>
                  {LINEUP_SLOTS.map((s) => {
                    const p = saved.slots?.[s.key]
                    return p ? <Img key={s.key} src={headshotOf(p)} size={28} className='home-mini-av' /> : null
                  })}
                </View>
              </View>
              <View style={{ textAlign: 'right' }} onClick={() => Taro.redirectTo({ url: '/pages/matchups/index' })}>
                <Text className='blue bold' style={{ fontSize: '20px', display: 'block', lineHeight: '22px' }}>{simScore.toFixed(1)}</Text>
                <Text className='dim small' style={{ display: 'block' }}>{zh() ? '今日模拟分' : 'Today Pts'}</Text>
                <Text className='blue small bold' style={{ display: 'block', marginTop: '3px' }}>{zh() ? '查看 PK ›' : 'Matchups ›'}</Text>
              </View>
            </View>
          ) : (
            <View className='row' style={{ justifyContent: 'space-between', gap: '10px' }}>
              <View className='flex1'>
                <Text className='bold' style={{ color: '#fff', fontSize: '13px', display: 'block' }}>
                  {zh() ? '今日赛前选人尚未开始' : 'Pick your 5 players for today'}
                </Text>
                <Text className='dim small' style={{ display: 'block', marginTop: '2px' }}>
                  {zh() ? `可用薪资帽 ${money(cap)} · 选满 5 人即可与好友 PK` : `Cap ${money(cap)} · Draft 5 to compete`}
                </Text>
              </View>
              <View className='home-cta' onClick={() => Taro.redirectTo({ url: '/pages/lineup/index' })}>
                <Text>{zh() ? '去选 5 人 ›' : 'Draft 5 ›'}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <Schedule initialDate={params.date} />
      <BottomNav active='home' />
    </View>
  )
}
