// Matchups — Step 2 & Step 3 of core gameplay (Mock Flow):
//  - My Starting 5: today's full box-score stats + rule-based score calculation & breakdown
//  - Friends Room PK: leaderboard + click any friend for 5v5 slot-by-slot head-to-head stat comparison
//  - Rules Tab: switch presets or tweak per-stat weights & recalculate all scores live
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { getLang } from '../../lib/i18n'
import { useFetch, useTabPage, go } from '../../lib/hooks'
import { etToday, money } from '../../lib/fmt'
import { headshotOf } from '../../lib/teams'
import { fullName, tableName } from '../../lib/names'
import {
  LINEUP_SLOTS, RULE_PRESETS, ScoringRule,
  loadLineup, saveLineup, loadCap, loadRule, saveRule, loadRoom, saveRoom,
  formatRuleFormula, getPlayerDailyBox, calcPlayerScore, buildAutoLineup, buildMockFriends,
} from '../../lib/scoring'
import { Loader, Seg, Img } from '../../components/ui'
import BottomNav from '../../components/BottomNav'
import './index.less'

const TODAY = process.env.TARO_APP_DEFAULT_DATE || etToday()
const zh = () => getLang() === 'zh'

export default function Matchups() {
  useTabPage('matchups')
  const [tab, setTab] = useState<'my5' | 'friends' | 'rules'>('my5')
  const [saved, setSaved] = useState(() => loadLineup())
  const [cap] = useState(() => loadCap())
  const [rule, setRule] = useState<ScoringRule>(() => loadRule())
  const [room, setRoom] = useState(() => loadRoom())
  const [joinCode, setJoinCode] = useState('')
  const [tick, setTick] = useState(0)
  const [selectedFriendId, setSelectedFriendId] = useState('f1')

  useDidShow(() => {
    setSaved(loadLineup())
    setRule(loadRule())
    setRoom(loadRoom())
  })

  const playersQ = useFetch(() => api.allPlayers(), [])
  const allPlayers = playersQ.data?.players || []
  const gameDate = saved.date || TODAY

  // If user hasn't picked 5 players yet, show CTA + allow 1-tap demo fill
  const mySlots = saved.slots || {}
  const myPicked = LINEUP_SLOTS.map((s) => mySlots[s.key]).filter(Boolean)
  const hasLineup = myPicked.length > 0

  const handleDemoFill = () => {
    if (!allPlayers.length) return
    const auto = buildAutoLineup(allPlayers, cap, 0)
    const next = { date: TODAY, locked: true, slots: auto }
    saveLineup(next)
    setSaved(next)
    Taro.showToast({ title: zh() ? '已生成并锁定演示 5 人阵容' : 'Demo 5-player lineup locked', icon: 'none' })
  }

  const applyRule = (r: ScoringRule) => {
    setRule(r)
    saveRule(r)
  }

  const updateWeight = (field: keyof Pick<ScoringRule, 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'fg3m' | 'tov'>, delta: number) => {
    const next: ScoringRule = {
      ...rule,
      key: 'custom',
      nameZh: '自定义规则',
      nameEn: 'Custom',
      [field]: Math.round((rule[field] + delta) * 10) / 10,
    }
    applyRule(next)
  }

  // Compute My Starting 5 daily box scores & rule scores
  const myRows = useMemo(() => {
    return LINEUP_SLOTS.map((s) => {
      const p = mySlots[s.key]
      if (!p) return { slot: s, player: null, box: null, score: null }
      const box = getPlayerDailyBox(p, gameDate, tick)
      const score = calcPlayerScore(box, rule)
      return { slot: s, player: p, box, score }
    })
  }, [mySlots, gameDate, tick, rule])

  const myTotalScore = Math.round(myRows.reduce((acc, r) => acc + (r.score?.total || 0), 0) * 10) / 10
  const myTotalSalary = myPicked.reduce((acc, p) => acc + (Number(p?.salary) || 0), 0)
  const myAgg = myRows.reduce(
    (acc, r) => {
      if (r.box) {
        acc.pts += r.box.pts; acc.reb += r.box.reb; acc.ast += r.box.ast
        acc.stl += r.box.stl; acc.blk += r.box.blk; acc.tov += r.box.tov
      }
      return acc
    },
    { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0 }
  )

  // Compute Friends Room
  const friends = useMemo(() => buildMockFriends(allPlayers, cap), [allPlayers, cap])

  const leaderboard = useMemo(() => {
    const calcEntry = (id: string, name: string, isMe: boolean, badge: string, liveCount: number, slots: any) => {
      let score = 0
      let salary = 0
      const agg = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0 }
      const slotItems: Record<string, { player: any; box: any; score: any }> = {}
      LINEUP_SLOTS.forEach((s) => {
        const p = slots[s.key]
        if (p) {
          salary += Number(p.salary) || 0
          const box = getPlayerDailyBox(p, gameDate, tick)
          const sc = calcPlayerScore(box, rule)
          score += sc.total
          agg.pts += box.pts; agg.reb += box.reb; agg.ast += box.ast
          agg.stl += box.stl; agg.blk += box.blk; agg.tov += box.tov
          slotItems[s.key] = { player: p, box, score: sc }
        }
      })
      return { id, name, isMe, badge, liveCount, score: Math.round(score * 10) / 10, salary, agg, slotItems }
    }

    const list = [
      calcEntry('me', zh() ? '你 (我的首发)' : 'You', true, saved.locked ? (zh() ? '已锁阵' : 'Locked') : (zh() ? '未锁阵' : 'Draft'), 3, mySlots),
      ...friends.map((f) => calcEntry(f.id, f.name, false, zh() ? f.badgeZh : f.badgeEn, f.liveCount, f.slots)),
    ]
    return list.sort((a, b) => b.score - a.score)
  }, [friends, mySlots, saved.locked, gameDate, tick, rule])

  const myRank = Math.max(1, leaderboard.findIndex((e) => e.isMe) + 1)
  const myEntry = leaderboard.find((e) => e.isMe)
  const oppEntry = leaderboard.find((e) => e.id === selectedFriendId) || leaderboard.find((e) => !e.isMe)

  const handleCopyInvite = () => {
    const txt = `${zh() ? '来「' + room.name + '」和我比拼今日 NBA 5人阵容！房间口令：#' : 'Join my NBA room #'}${room.code}`
    Taro.setClipboardData({ data: txt }).then(() => Taro.showToast({ title: zh() ? '已复制房间口令' : 'Room code copied', icon: 'none' })).catch(() => {})
  }

  const handleSwitchRoom = () => {
    const code = joinCode.trim().replace(/^#/, '')
    if (!code) return
    const next = { code, name: zh() ? `好友局 #${code}` : `Room #${code}` }
    setRoom(next)
    saveRoom(next)
    setJoinCode('')
    Taro.showToast({ title: zh() ? `已进入房间 #${code}` : `Joined #${code}`, icon: 'none' })
  }

  return (
    <View className='page'>
      {/* Header */}
      <View className='mu-h'>
        <View className='mu-top'>
          <View>
            <Text className='h-title'>{zh() ? '赛日计分与好友对战' : 'Matchups & Scoring'}</Text>
            <Text className='dim small' style={{ display: 'block', marginTop: '2px' }}>
              🏀 {room.name} #{room.code} · {gameDate}
            </Text>
          </View>
          <View className='btn sm ghost' onClick={() => setTick((x) => x + 1)}>
            {zh() ? '↻ 模拟刷新赛况' : '↻ Sim Live'}
          </View>
        </View>
        <View style={{ marginTop: '8px' }}>
          <Seg
            items={[
              ['my5', zh() ? '我的计分' : 'My 5'],
              ['friends', zh() ? '好友 PK' : 'Friends'],
              ['rules', zh() ? '计分规则' : 'Rules'],
            ]}
            value={tab}
            onChange={(v) => setTab(v as any)}
          />
        </View>
      </View>

      <Loader loading={playersQ.loading && !allPlayers.length} error={playersQ.error} onRetry={playersQ.reload}>
        {!hasLineup && tab !== 'rules' ? (
          <View className='card mu-empty'>
            <Text className='bold' style={{ fontSize: '15px', color: '#fff', display: 'block' }}>
              {zh() ? '你还没有挑选今日 5 人首发阵容' : 'No 5-player lineup picked yet'}
            </Text>
            <Text className='dim small' style={{ display: 'block', margin: '8px 0 14px' }}>
              {zh() ? '先去 Lineup 球场按薪资帽选满 5 名球员，或一键生成演示阵容体验完整计分与好友 PK 流程。' : 'Pick 5 players under the salary cap on Lineup, or auto-generate a demo lineup.'}
            </Text>
            <View className='row' style={{ gap: '10px', justifyContent: 'center' }}>
              <View className='btn sm primary' onClick={() => Taro.redirectTo({ url: '/pages/lineup/index' })}>
                {zh() ? '去选 5 名球员 ›' : 'Pick Lineup ›'}
              </View>
              <View className='btn sm ghost' onClick={handleDemoFill}>
                {zh() ? '⚡ 一键演示阵容' : '⚡ Demo Lineup'}
              </View>
            </View>
          </View>
        ) : null}

        {/* TAB 1: MY STARTING 5 SCORING */}
        {tab === 'my5' && hasLineup && (
          <View className='mu-sec'>
            {/* Hero Total Score Card */}
            <View className='hero-card card'>
              <View className='hero-top'>
                <View>
                  <Text className='dim small'>{zh() ? '今日 5 人技术统计总得分' : "TODAY'S TOTAL SCORE"}</Text>
                  <View className='row' style={{ alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                    <Text className='hero-score'>{myTotalScore.toFixed(1)}</Text>
                    <Text className='orange bold'>{zh() ? '分' : 'PTS'}</Text>
                  </View>
                </View>
                <View style={{ textAlign: 'right' }}>
                  <Text className='dim small'>{zh() ? '好友房间实时排名' : 'Room Rank'}</Text>
                  <Text className='hero-rank' style={{ display: 'block' }}>🏆 #{myRank} / {leaderboard.length}</Text>
                  <Text className='dim small'>
                    {myTotalSalary ? `${money(myTotalSalary)} · ${(myTotalScore / (myTotalSalary / 1e6)).toFixed(2)} 分/$M` : ''}
                  </Text>
                </View>
              </View>

              {/* Team Aggregate Stats */}
              <View className='agg-grid'>
                {[
                  [zh() ? '得分' : 'PTS', myAgg.pts, 'blue'],
                  [zh() ? '篮板' : 'REB', myAgg.reb, ''],
                  [zh() ? '助攻' : 'AST', myAgg.ast, ''],
                  [zh() ? '抢断' : 'STL', myAgg.stl, 'green'],
                  [zh() ? '盖帽' : 'BLK', myAgg.blk, 'green'],
                  [zh() ? '失误' : 'TOV', myAgg.tov, 'err'],
                ].map(([l, v, cls]) => (
                  <View key={String(l)} className='agg-cell'>
                    <Text className={'agg-v ' + cls}>{v}</Text>
                    <Text className='agg-l'>{l}</Text>
                  </View>
                ))}
              </View>

              <View className='formula-bar' onClick={() => setTab('rules')}>
                <Text className='dim small'>{zh() ? '当前规则：' : 'Rule: '}{zh() ? rule.nameZh : rule.nameEn}</Text>
                <Text className='blue small'>{zh() ? '调整规则 ›' : 'Edit ›'}</Text>
              </View>
            </View>

            {/* 5 Player Cards with Full Box Score & Breakdown */}
            <View className='row' style={{ justifyContent: 'space-between', margin: '10px 2px 6px' }}>
              <Text className='dim small'>{zh() ? '球员当日比赛数据 & 得分拆解' : 'Daily Box Score & Breakdown'}</Text>
              <Text className='blue small' onClick={() => Taro.redirectTo({ url: '/pages/lineup/index' })}>
                {zh() ? '调整阵容 ›' : 'Edit Lineup ›'}
              </Text>
            </View>

            {myRows.map(({ slot, player, box, score }) => {
              if (!player || !box || !score) {
                return (
                  <View key={slot.key} className='pcard card' onClick={() => Taro.redirectTo({ url: '/pages/lineup/index' })}>
                    <Text className='dim small'>{slot.key} ({zh() ? slot.labelZh : slot.labelEn}) — {zh() ? '空缺，点击前往补齐' : 'Empty slot'}</Text>
                  </View>
                )
              }
              return (
                <View key={slot.key} className='pcard card'>
                  <View className='pcard-h' onClick={() => go(`/pages/player/index?id=${player.id}`)}>
                    <Img src={headshotOf(player)} size={40} />
                    <View className='flex1' style={{ marginLeft: '8px' }}>
                      <View className='row' style={{ gap: '6px' }}>
                        <Text className='slot-tag'>{slot.key}</Text>
                        <Text className='bold' style={{ color: '#fff', fontSize: '13px' }}>{fullName(player)}</Text>
                        <Text className='orange small'>{money(player.salary)}</Text>
                      </View>
                      <Text className={box.status === 'live' ? 'live-t' : 'dim small'}>{box.statusText} · {box.min} MIN</Text>
                    </View>
                    <View style={{ textAlign: 'right' }}>
                      <Text className='blue bold' style={{ fontSize: '17px' }}>{score.total.toFixed(1)}</Text>
                      <Text className='dim small' style={{ display: 'block' }}>{zh() ? '判定得分' : 'PTS'}</Text>
                    </View>
                  </View>

                  <View className='box-grid'>
                    {[
                      ['PTS', box.pts], ['REB', box.reb], ['AST', box.ast],
                      ['STL', box.stl], ['BLK', box.blk], ['TOV', box.tov], ['FG', box.fg],
                    ].map(([k, v]) => (
                      <View key={String(k)} className='box-cell'>
                        <Text className='box-k'>{k}</Text>
                        <Text className='box-v'>{v}</Text>
                      </View>
                    ))}
                  </View>

                  <View className='bd-bar'>
                    <Text className='dim small'>{zh() ? '计分拆解:' : 'Breakdown:'}</Text>
                    <Text className='small' style={{ color: '#cbd5e1' }}>
                      {zh() ? '得分' : 'PTS'}<Text className='blue'>+{score.breakdown.pts}</Text>
                      {' · '}{zh() ? '板' : 'REB'}<Text className='blue'>+{score.breakdown.reb}</Text>
                      {' · '}{zh() ? '助' : 'AST'}<Text className='blue'>+{score.breakdown.ast}</Text>
                      {' · '}{zh() ? '防' : 'DEF'}<Text className='green'>+{score.breakdown.def}</Text>
                      {' · '}{zh() ? '失' : 'TOV'}<Text className='err'>{score.breakdown.tov}</Text>
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* TAB 2: FRIENDS LEADERBOARD & 5v5 HEAD-TO-HEAD PK */}
        {tab === 'friends' && (
          <View className='mu-sec'>
            {/* Room Invite / Switch */}
            <View className='card room-bar'>
              <View className='row' style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
                <View>
                  <Text className='bold' style={{ color: '#fff', fontSize: '14px' }}>🏀 {room.name}</Text>
                  <Text className='dim small' style={{ display: 'block' }}>
                    {zh() ? `房间口令 #${room.code} · 共 ${leaderboard.length} 位好友` : `Room #${room.code} · ${leaderboard.length} players`}
                  </Text>
                </View>
                <View className='btn sm primary' onClick={handleCopyInvite}>{zh() ? '+ 复制口令拉好友' : '+ Invite'}</View>
              </View>
              <View className='row' style={{ gap: '8px' }}>
                <Input
                  className='room-input flex1'
                  placeholder={zh() ? '输入其他房间号切换（如 2027）' : 'Enter room code to switch'}
                  value={joinCode}
                  onInput={(e) => setJoinCode(e.detail.value)}
                />
                <View className='btn sm ghost' onClick={handleSwitchRoom}>{zh() ? '加入房间' : 'Join'}</View>
              </View>
            </View>

            {/* Leaderboard */}
            <View className='card lb-card'>
              <Text className='bold' style={{ color: '#fff', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                {zh() ? '今日好友积分榜（点击任意好友查看 5v5 对位）' : 'Friends Leaderboard (Tap to compare 5v5)'}
              </Text>
              {leaderboard.map((e, i) => {
                const isSel = !e.isMe && oppEntry?.id === e.id
                return (
                  <View
                    key={e.id}
                    className={'lb-row' + (e.isMe ? ' me' : '') + (isSel ? ' sel' : '')}
                    onClick={() => !e.isMe && setSelectedFriendId(e.id)}
                  >
                    <Text className={'lb-rank' + (i === 0 ? ' gold' : '')}>#{i + 1}</Text>
                    <View className='flex1'>
                      <View className='row' style={{ gap: '6px' }}>
                        <Text className='bold' style={{ color: e.isMe ? '#6EE2F5' : '#fff', fontSize: '13px' }}>{e.name}</Text>
                        <Text className='lb-badge'>{e.badge}</Text>
                        {isSel && <Text className='pk-badge'>PK</Text>}
                      </View>
                      <View className='row' style={{ gap: '6px', marginTop: '3px' }}>
                        <View className='row'>
                          {LINEUP_SLOTS.map((s) => {
                            const p = e.slotItems[s.key]?.player
                            return p ? <Img key={s.key} src={headshotOf(p)} size={18} className='mini-av' /> : null
                          })}
                        </View>
                        <Text className='dim small'>{money(e.salary)}</Text>
                      </View>
                    </View>
                    <View style={{ textAlign: 'right' }}>
                      <Text className={e.isMe ? 'blue bold' : 'bold'} style={{ fontSize: '15px', color: e.isMe ? '#6EE2F5' : '#fff' }}>
                        {e.score.toFixed(1)}
                      </Text>
                      <Text className='live-t' style={{ display: 'block' }}>{e.liveCount} LIVE</Text>
                    </View>
                  </View>
                )
              })}
            </View>

            {/* 5v5 Head-to-Head Comparison */}
            {myEntry && oppEntry && (
              <View className='card pk-card'>
                <View className='pk-head'>
                  <View>
                    <Text className='dim small'>{zh() ? '我的首发' : 'You'}</Text>
                    <Text className='blue bold' style={{ fontSize: '18px', display: 'block' }}>{myEntry.score.toFixed(1)}</Text>
                  </View>
                  <View style={{ textAlign: 'center' }}>
                    {(() => {
                      const diff = Math.round((myEntry.score - oppEntry.score) * 10) / 10
                      return (
                        <View className={'diff-pill ' + (diff >= 0 ? 'win' : 'lose')}>
                          <Text>{diff >= 0 ? `${zh() ? '领先' : 'UP'} +${diff.toFixed(1)}` : `${zh() ? '落后' : 'DOWN'} ${diff.toFixed(1)}`}</Text>
                        </View>
                      )
                    })()}
                    <Text className='dim small' style={{ display: 'block', marginTop: '3px' }}>{zh() ? '5v5 对位对比' : '5v5 Head-to-Head'}</Text>
                  </View>
                  <View style={{ textAlign: 'right' }}>
                    <Text className='dim small'>{oppEntry.name.split(' ')[0]}</Text>
                    <Text className='orange bold' style={{ fontSize: '18px', display: 'block' }}>{oppEntry.score.toFixed(1)}</Text>
                  </View>
                </View>

                {/* 5 Category Team Totals */}
                <View className='pk-cats'>
                  {[
                    [zh() ? '得分' : 'PTS', 'pts'],
                    [zh() ? '篮板' : 'REB', 'reb'],
                    [zh() ? '助攻' : 'AST', 'ast'],
                    [zh() ? '抢断' : 'STL', 'stl'],
                    [zh() ? '盖帽' : 'BLK', 'blk'],
                  ].map(([l, k]) => {
                    const mv = (myEntry.agg as any)[k] || 0
                    const ov = (oppEntry.agg as any)[k] || 0
                    return (
                      <View key={String(k)} className='pk-cat'>
                        <Text className='dim small'>{l}</Text>
                        <Text className='small bold' style={{ display: 'block', marginTop: '2px' }}>
                          <Text className={mv >= ov ? 'blue' : 'dim'}>{mv}</Text>
                          <Text className='dim'> : </Text>
                          <Text className={ov > mv ? 'orange' : 'dim'}>{ov}</Text>
                        </Text>
                      </View>
                    )
                  })}
                </View>

                {/* Slot by Slot Rows */}
                {LINEUP_SLOTS.map((s) => {
                  const m = myEntry.slotItems[s.key]
                  const o = oppEntry.slotItems[s.key]
                  const ms = m?.score?.total || 0
                  const os = o?.score?.total || 0
                  const myWin = ms >= os
                  return (
                    <View key={s.key} className='pk-slot'>
                      <View className='pk-side'>
                        {m?.player ? <Img src={headshotOf(m.player)} size={28} /> : null}
                        <View className='flex1' style={{ marginLeft: '6px', minWidth: 0 }}>
                          <Text className='ell bold' style={{ fontSize: '11px', color: '#fff', display: 'block' }}>
                            {m?.player ? tableName(m.player) : '—'}
                          </Text>
                          <Text className='dim' style={{ fontSize: '10px' }}>
                            {m?.box ? `${m.box.pts}/${m.box.reb}/${m.box.ast}` : '—'}
                          </Text>
                        </View>
                      </View>

                      <View className='pk-mid'>
                        <Text className='slot-tag'>{s.key}</Text>
                        <Text className='small bold' style={{ display: 'block', marginTop: '3px' }}>
                          <Text className={myWin ? 'blue' : 'dim'}>{ms.toFixed(1)}</Text>
                          <Text className='dim'> - </Text>
                          <Text className={!myWin ? 'orange' : 'dim'}>{os.toFixed(1)}</Text>
                        </Text>
                      </View>

                      <View className='pk-side right'>
                        <View className='flex1' style={{ marginRight: '6px', minWidth: 0, textAlign: 'right' }}>
                          <Text className='ell bold' style={{ fontSize: '11px', color: '#fff', display: 'block' }}>
                            {o?.player ? tableName(o.player) : '—'}
                          </Text>
                          <Text className='dim' style={{ fontSize: '10px' }}>
                            {o?.box ? `${o.box.pts}/${o.box.reb}/${o.box.ast}` : '—'}
                          </Text>
                        </View>
                        {o?.player ? <Img src={headshotOf(o.player)} size={28} /> : null}
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}

        {/* TAB 3: SCORING RULES */}
        {tab === 'rules' && (
          <View className='mu-sec'>
            <View className='card rule-card'>
              <Text className='bold' style={{ color: '#fff', fontSize: '14px', display: 'block', marginBottom: '6px' }}>
                {zh() ? '预设技术统计计分规则（切换即时生效）' : 'Scoring Rule Presets'}
              </Text>
              <View className='rule-presets'>
                {RULE_PRESETS.map((p) => (
                  <View key={p.key} className={'preset-item' + (rule.key === p.key ? ' on' : '')} onClick={() => applyRule(p)}>
                    <Text className='bold' style={{ color: rule.key === p.key ? '#6EE2F5' : '#fff', fontSize: '13px', display: 'block' }}>
                      {zh() ? p.nameZh : p.nameEn}
                    </Text>
                    <Text className='dim small'>{formatRuleFormula(p)}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className='card rule-card'>
              <Text className='bold' style={{ color: '#fff', fontSize: '14px', display: 'block', marginBottom: '6px' }}>
                {zh() ? '微调单项技术统计权重' : 'Customize Stat Weights'}
              </Text>
              {([
                ['pts', zh() ? '得分 (PTS)' : 'Points (PTS)', 0.5],
                ['reb', zh() ? '篮板 (REB)' : 'Rebounds (REB)', 0.2],
                ['ast', zh() ? '助攻 (AST)' : 'Assists (AST)', 0.5],
                ['stl', zh() ? '抢断 (STL)' : 'Steals (STL)', 0.5],
                ['blk', zh() ? '盖帽 (BLK)' : 'Blocks (BLK)', 0.5],
                ['fg3m', zh() ? '三分命中 (3PM)' : '3-Pointers (3PM)', 0.5],
                ['tov', zh() ? '失误 (TOV)' : 'Turnovers (TOV)', 0.5],
              ] as [keyof Pick<ScoringRule, 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'fg3m' | 'tov'>, string, number][]).map(([field, label, step]) => (
                <View key={field} className='w-row'>
                  <Text style={{ color: '#E0EFFF', fontSize: '13px' }}>{label}</Text>
                  <View className='row' style={{ gap: '10px' }}>
                    <View className='cap-step' onClick={() => updateWeight(field, -step)}>-</View>
                    <Text className='w-val'>{rule[field]}</Text>
                    <View className='cap-step' onClick={() => updateWeight(field, step)}>+</View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </Loader>

      <BottomNav active='matchups' />
    </View>
  )
}
