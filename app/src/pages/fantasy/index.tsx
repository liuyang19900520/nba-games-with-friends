import { Button, Input, Picker, View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { calcFantasyScore, defaultRules, FantasyRules, normalizeRules } from '../../lib/fantasy'
import { readFantasyRules, saveFantasyRules, resetFantasyRules } from '../../lib/fantasyStorage'
import { useFetch } from '../../lib/hooks'
import { fullName } from '../../lib/names'
import { headshotOf } from '../../lib/teams'
import { Loader, Img } from '../../components/ui'
import './index.less'

const GAME_ID = '401909877'
const labels: Record<string, [string, string]> = {
  ...Object.fromEntries(defaultRules.stats.map((r) => [r.key, [r.labelZh, r.labelEn]])),
  doubleDouble: ['两双奖励', 'Double-double bonus'], tripleDouble: ['三双奖励', 'Triple-double bonus'],
}
const validNumber = (s: string) => /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(s.trim()) && Number.isFinite(Number(s))

export default function FantasyRulesPage() {
  const [rules, setRules] = useState<FantasyRules>(() => readFantasyRules())
  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(readFantasyRules()))
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState(0)
  const [side, setSide] = useState(0)
  const game = useFetch(() => api.game(GAME_ID), [])
  useDidShow(() => {
    const latest = readFantasyRules()
    setRules(latest)
    setDraft(toDraft(latest))
  })

  const data = game.data || {}
  const box: any[] = data.box || []
  const teamId = side === 0 ? data.game?.away?.id : data.game?.home?.id
  const players: any[] = (box.find((x: any) => x.team_id === teamId)?.players || []).filter((p: any) => !p.dnp)
  const player = players[selected] || players[0]
  const effectiveRules = useMemo(() => normalizeRules({
    stats: rules.stats.map((r) => ({ ...r, weight: validNumber(draft[r.key] || '') ? Number(draft[r.key]) : r.weight })),
    doubleDouble: validNumber(draft.doubleDouble || '') ? Number(draft.doubleDouble) : rules.doubleDouble,
    tripleDouble: validNumber(draft.tripleDouble || '') ? Number(draft.tripleDouble) : rules.tripleDouble,
  }), [rules, draft])
  const score = calcFantasyScore(player, effectiveRules)

  function change(key: string, value: string) {
    setDraft((old) => ({ ...old, [key]: value }))
    setMessage('')
  }
  function save() {
    const keys = [...rules.stats.map((r) => r.key), 'doubleDouble', 'tripleDouble']
    if (keys.some((key) => !validNumber(draft[key] ?? ''))) {
      setMessage('请输入有效数字；权重不能为空。')
      return
    }
    const next = normalizeRules({ stats: rules.stats.map((r) => ({ key: r.key, weight: Number(draft[r.key]) })), doubleDouble: Number(draft.doubleDouble), tripleDouble: Number(draft.tripleDouble) })
    try {
      saveFantasyRules(next)
      setRules(next)
      setDraft(toDraft(next))
      setMessage('规则已保存')
    } catch (_) { setMessage('保存失败，请检查设备存储空间后重试。') }
  }
  function reset() {
    try {
      const next = resetFantasyRules()
      setRules(next); setDraft(toDraft(next)); setMessage('已恢复默认规则')
    } catch (_) { setMessage('重置失败，请稍后重试。') }
  }

  return <View className='page fantasy-page'>
    <View className='f-head'><Text className='f-title'>范特西分规则</Text><Text className='f-sub'>设置每项数据的权重，查看球员得分如何组成。</Text></View>
    <View className='f-sheet'>
      <View className='f-row f-colhead'><Text>统计项</Text><Text>每项权重</Text></View>
      {rules.stats.map((r) => <RuleInput key={r.key} id={r.key} value={draft[r.key]} onChange={change} />)}
      <View className='f-divider' />
      <View className='f-row f-colhead'><Text>里程碑奖励</Text><Text>奖励分</Text></View>
      <RuleInput id='doubleDouble' value={draft.doubleDouble} onChange={change} />
      <RuleInput id='tripleDouble' value={draft.tripleDouble} onChange={change} />
      <Text className='f-note'>两双与三双奖励互斥：达成三双时只计三双奖励。</Text>
    </View>
    {message && <Text className={'f-message' + (message.includes('失败') || message.includes('有效') ? ' error' : '')}>{message}</Text>}
    <View className='f-actions'><Button className='f-reset' onClick={reset}>恢复默认</Button><Button className='f-save' onClick={save}>保存规则</Button></View>

    <View className='f-test-head'><Text className='f-title'>实时试算</Text><Text className='f-sub'>{data.game?.date || ''} · {data.game?.short_name || 'BKN @ BOS'}</Text></View>
    <View className='f-selectors'>
      <View className='f-switch'><Button className={'f-side' + (side === 0 ? ' on' : '')} onClick={() => { setSide(0); setSelected(0) }}>BKN</Button><Button className={'f-side' + (side === 1 ? ' on' : '')} onClick={() => { setSide(1); setSelected(0) }}>BOS</Button></View>
      <Picker mode='selector' range={players.map((p) => fullName(p))} value={selected} onChange={(e) => setSelected(Number(e.detail.value))}>
        <View className='f-player-select'>{player ? fullName(player) : '选择球员'} <Text className='dim'>⌄</Text></View>
      </Picker>
    </View>
    <Loader loading={game.loading && !game.data} error={game.error} onRetry={game.reload} empty={!player}>
      {player && <View className='f-result'>
        <View className='f-player'><Img src={headshotOf(player)} size={42} /><View><Text className='f-player-name'>{fullName(player)}</Text><Text className='f-sub'>{player.position || ''} · {player.min} min</Text></View><Text className='f-total'>{score.score.toFixed(1)}</Text></View>
        {score.breakdown.map((item) => <View className='f-detail' key={item.key}><Text>{labels[item.key]?.[0] || item.key}<Text className='dim'> {item.value} × {item.weight}</Text></Text><Text>{format(item.points)}</Text></View>)}
        {score.bonus && <View className='f-detail'><Text>{labels[score.bonus.key][0]}</Text><Text>{format(score.bonus.points)}</Text></View>}
        <View className='f-detail f-sum'><Text>合计</Text><Text>{score.score.toFixed(1)}</Text></View>
      </View>}
    </Loader>
  </View>
}

function RuleInput({ id, value, onChange }: { id: string; value: string; onChange: (key: string, value: string) => void }) {
  const [zh, en] = labels[id]
  const bad = value == null || value === '' || !validNumber(value)
  return <View className='f-row f-input-row'>
    <Text className='f-label'>{zh}<Text className='f-en'>{en}</Text></Text>
    <Input className={'f-input' + (bad ? ' invalid' : '')} type='text' value={value ?? ''} onInput={(e) => onChange(id, e.detail.value)} aria-label={`${zh} ${en} weight`} />
  </View>
}
function toDraft(r: FantasyRules): Record<string, string> {
  return Object.fromEntries([...r.stats.map((x) => [x.key, String(x.weight)]), ['doubleDouble', String(r.doubleDouble)], ['tripleDouble', String(r.tripleDouble)]])
}
function format(n: number) { return `${n > 0 ? '+' : ''}${Number(n.toFixed(2))}` }
