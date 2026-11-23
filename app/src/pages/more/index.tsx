import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { t, setLang, getLang } from '../../lib/i18n'
import { useFetch, useTabPage, go } from '../../lib/hooks'
import { teamName, headshotOf } from '../../lib/teams'
import { fullName } from '../../lib/names'
import { etToday, money } from '../../lib/fmt'
import { LINEUP_SLOTS, loadLineup, loadCap, loadRule, loadRoom, formatRuleFormula, getPlayerDailyBox, calcPlayerScore } from '../../lib/scoring'
import { Loader, Img, Section } from '../../components/ui'
import BottomNav from '../../components/BottomNav'
import './index.less'

const TODAY = process.env.TARO_APP_DEFAULT_DATE || etToday()

export default function More() {
  const lang = useTabPage('more')
  const zh = lang === 'zh'
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

  const inj = useFetch(() => api.injuries(), [])

  const picked = useMemo(() => LINEUP_SLOTS.map((s) => saved.slots?.[s.key]).filter(Boolean), [saved])
  const gameDay = saved.date || TODAY
  const simScore = picked.reduce((s, p) => s + calcPlayerScore(getPlayerDailyBox(p, gameDay), rule).total, 0)

  return (
    <View className='page'>
      {/* Manager Hero Card */}
      <View className='pr-hero card'>
        <View className='row' style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View className='row' style={{ gap: '10px' }}>
            <View className='pr-avatar'><Text>🏀</Text></View>
            <View>
              <Text className='bold' style={{ fontSize: '16px', color: '#fff', display: 'block' }}>
                {zh ? '球队经理 · 演示账号' : 'Team Manager · Demo'}
              </Text>
              <Text className='dim small' style={{ display: 'block', marginTop: '2px' }}>
                {room.name} #{room.code}
              </Text>
            </View>
          </View>
          <View className='picker' onClick={() => setLang(zh ? 'en' : 'zh')}>{t('lang')}</View>
        </View>

        <View className='pr-stats'>
          <View className='pr-stat' onClick={() => Taro.redirectTo({ url: '/pages/lineup/index' })}>
            <Text className='pr-stat-v'>{picked.length}/5</Text>
            <Text className='pr-stat-l'>{saved.locked ? (zh ? '已锁阵容' : 'Locked') : (zh ? '今日阵容' : 'Lineup')}</Text>
          </View>
          <View className='pr-stat' onClick={() => Taro.redirectTo({ url: '/pages/matchups/index' })}>
            <Text className='pr-stat-v blue'>{picked.length ? simScore.toFixed(1) : '—'}</Text>
            <Text className='pr-stat-l'>{zh ? '今日模拟分' : 'Today Pts'}</Text>
          </View>
          <View className='pr-stat' onClick={() => Taro.redirectTo({ url: '/pages/lineup/index' })}>
            <Text className='pr-stat-v orange'>{money(cap)}</Text>
            <Text className='pr-stat-l'>{zh ? '薪资帽' : 'Salary Cap'}</Text>
          </View>
        </View>
      </View>

      {/* Active Fantasy Scoring Rules Card */}
      <View className='pr-rule card' onClick={() => Taro.navigateTo({ url: '/pages/fantasy/index' })}>
        <View className='row' style={{ justifyContent: 'space-between', marginBottom: '4px' }}>
          <Text className='bold' style={{ color: '#fff', fontSize: '14px' }}>
            📐 {zh ? '当前计分规则（范特西分）' : 'Active Scoring Rules'}
          </Text>
          <Text className='blue small bold'>{zh ? '编辑 17 项规则 ›' : 'Edit Rules ›'}</Text>
        </View>
        <Text className='dim small' style={{ display: 'block', lineHeight: '16px' }}>
          {formatRuleFormula(rule)} · {zh ? `两双 +${rule.doubleDouble} / 三双 +${rule.tripleDouble}` : `DD2 +${rule.doubleDouble} / TD3 +${rule.tripleDouble}`}
        </Text>
      </View>

      {/* 2x2 Quick Navigation Grid */}
      <View className='pr-grid'>
        {[
          ['⚡', zh ? '好友对战 PK' : 'Matchups PK', '/pages/matchups/index', true],
          ['🏀', t('allTeams'), '/pages/teams/index', false],
          ['🏆', t('standings'), '/pages/standings/index', true],
          ['⭐', t('leaders'), '/pages/leaders/index', false],
        ].map(([ico, label, url, isTab]) => (
          <View
            key={String(url)}
            className='pr-tile card'
            onClick={() => (isTab ? Taro.redirectTo({ url: String(url) }) : go(String(url)))}
          >
            <Text className='pr-tile-ico'>{ico}</Text>
            <Text className='pr-tile-lbl'>{label}</Text>
          </View>
        ))}
      </View>

      {/* Injuries Section */}
      <Section title={t('injuries')}>
        <Loader loading={inj.loading} error={inj.error} onRetry={inj.reload} empty={!inj.loading && !(inj.data?.teams || []).length}>
          {(inj.data?.teams || []).map((g: any) => (
            <View key={g.team?.id} className='inj-group'>
              <Text className='inj-team-t'>{teamName(g.team, true)}</Text>
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
            </View>
          ))}
        </Loader>
      </Section>

      <View className='dim foot'>{t('about')} · v2 · {process.env.TARO_APP_API_MODE === 'mock' ? (zh ? '演示数据（离线快照）' : 'Demo data (offline snapshot)') : `API: ${process.env.TARO_APP_API_BASE}`}</View>
      <BottomNav active='profile' />
    </View>
  )
}
