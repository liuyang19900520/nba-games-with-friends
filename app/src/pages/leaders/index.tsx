import { View } from '@tarojs/components'
import { useTabPage } from '../../lib/hooks'
import PlayerLeaders from '../../components/PlayerLeaders'
import BottomNav from '../../components/BottomNav'
import './index.less'

export default function Leaders() {
  useTabPage('leaders')
  return (
    <View className='page lead-page'>
      <PlayerLeaders />
      <BottomNav active='leagues' />
    </View>
  )
}
