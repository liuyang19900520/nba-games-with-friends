import { View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { useTabPage } from '../../lib/hooks'
import Schedule from '../../components/Schedule'
import BottomNav from '../../components/BottomNav'
import './index.less'

export default function Index() {
  useTabPage('schedule')
  const params = useRouter().params as any
  return (
    <View className='page'>
      <Schedule initialDate={params.date} />
      <BottomNav active='home' />
    </View>
  )
}
