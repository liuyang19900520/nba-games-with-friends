import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import { api } from '../../lib/api'
import { t, getLang } from '../../lib/i18n'
import { useFetch, useTabPage, go } from '../../lib/hooks'
import { teamName, logoOf } from '../../lib/teams'
import { Loader, Img, Table, Seg } from '../../components/ui'

const COLS = ['wins', 'losses', 'win_pct', 'games_behind', 'home', 'away', 'conf', 'div', 'last10', 'streak', 'ppg', 'opp_ppg', 'diff', 'seed']
export default function Standings() {
  useTabPage('standings')
  const [conf, setConf] = useState('East')
  const q = useFetch(() => api.standings(), [])
  const confs: any[] = q.data?.conferences || []
  const c = confs.find((x) => x.abbr === conf) || confs[0]
  const rows = (c?.teams || []).map((r: any) => ({ ...r, win_pct: r.win_pct != null ? +(r.win_pct * (r.win_pct <= 1 ? 100 : 1)).toFixed(1) : null }))
  return (
    <View className='page'>
      <View className='topbar'>
        <Seg items={[['East', t('east')], ['West', t('west')]]} value={conf} onChange={setConf} />
        <Text className='dim' style={{ fontSize: '11px' }}>{q.data?.season ? `${q.data.season - 1}-${String(q.data.season).slice(2)}` : ''}</Text>
      </View>
      <Loader loading={q.loading && !q.data} error={q.error} onRetry={q.reload} empty={!q.loading && !rows.length}>
        <View style={{ margin: '0 8px' }}>
          <Table rows={rows} cols={COLS.filter((k) => rows.some((r: any) => r[k] != null))} firstWidth={128} firstHead={t('team')}
            onRow={(r) => go(`/pages/team/index?id=${r.team.id}`)}
            first={(r) => (<>
              <Text className={r.rank <= 6 ? 'blue bold' : r.rank <= 10 ? 'orange bold' : 'dim'} style={{ width: '18px' }}>{r.rank}</Text>
              <Img src={logoOf(r.team)} size={22} round={false} />
              <Text className='ell'>{teamName(r.team)}</Text>
            </>)} />
          <View className='dim' style={{ fontSize: '10px', padding: '8px 2px' }}>
            {getLang() === 'zh' ? '蓝色 1-6 直接晋级季后赛 · 橙色 7-10 附加赛' : 'Blue 1-6 playoffs · Orange 7-10 play-in'}
          </View>
        </View>
      </Loader>
    </View>
  )
}
