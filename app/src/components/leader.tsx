import { View, Text } from '@tarojs/components'
import { getLang } from '../lib/i18n'
import { go } from '../lib/hooks'
import { teamName, headshotOf } from '../lib/teams'
import { num, stat } from '../lib/fmt'
import { Img } from './ui'
import { tableName } from '../lib/names'
export const catName = (c: any) => (getLang() === 'zh' ? c.zh : c.en) || c.key
export function fmtVal(key: string, v: any) {
  return stat(key, v)
}
/** '36.0分 6.8板 8.3助' */
export function subLine(l: any) {
  const s = l.stats || l.averages || l
  const zh = getLang() === 'zh'
  const parts: string[] = []
  if (s.pts != null) parts.push(zh ? `${stat('pts', s.pts)}分` : `${stat('pts', s.pts)} PTS`)
  if (s.reb != null) parts.push(zh ? `${stat('reb', s.reb)}板` : `${stat('reb', s.reb)} REB`)
  if (s.ast != null) parts.push(zh ? `${stat('ast', s.ast)}助` : `${stat('ast', s.ast)} AST`)
  if (!parts.length && l.gp != null) parts.push(zh ? `${l.gp}场` : `${l.gp} GP`)
  return parts.join(' ')
}
export function LeaderRow({ l, cat }: { l: any; cat: string }) {
  const p = l.player || {}
  return (
    <View className='lrow' onClick={() => go(`/pages/player/index?id=${p.id}`)}>
      <Text className={'lr-rank' + (l.rank <= 3 ? ' top' : '')}>{l.rank}</Text>
      <Img src={headshotOf(p)} size={36} />
      <View className='flex1 lr-mid'>
        <Text className='lr-name'>{tableName(p)}</Text>
        <Text className='lr-sub dim'>{subLine(l)}</Text>
      </View>
      <Text className='lr-team dim ell'>{teamName(l.team)}</Text>
      <Text className='lr-val'>{fmtVal(cat, l.value)}</Text>
    </View>
  )
}

