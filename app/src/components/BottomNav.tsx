// Bottom navigation = v1 (legacy-v1 apps/web/src/components/layout/BottomNav.tsx): same 5 items, order, icons
// (lucide Home/Trophy/Users/User + center basketball), labels, colors, raised gradient center button when active.
// Rendered by each top-level page (not the native tabBar) so weapp and H5 look identical. Mapping: docs/ui-navigation.md
import { View, Image, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import home from '../assets/nav/home.png'; import homeOn from '../assets/nav/home-on.png'
import trophy from '../assets/nav/trophy.png'; import trophyOn from '../assets/nav/trophy-on.png'
import ball from '../assets/nav/ball.png'; import ballOn from '../assets/nav/ball-on.png'
import users from '../assets/nav/users.png'; import usersOn from '../assets/nav/users-on.png'
import user from '../assets/nav/user.png'; import userOn from '../assets/nav/user-on.png'
import './BottomNav.less'

export type NavKey = 'home' | 'leagues' | 'lineup' | 'matchups' | 'profile'
const ITEMS: { key: NavKey; label: string; url: string; icon: [string, string]; center?: boolean }[] = [
  { key: 'home', label: 'Home', url: '/pages/index/index', icon: [home, homeOn] },
  { key: 'leagues', label: 'Leagues', url: '/pages/standings/index', icon: [trophy, trophyOn] },
  { key: 'lineup', label: 'Lineup', url: '/pages/lineup/index', icon: [ball, ballOn], center: true },
  { key: 'matchups', label: 'Matchups', url: '/pages/leaders/index', icon: [users, usersOn] },
  { key: 'profile', label: 'Profile', url: '/pages/more/index', icon: [user, userOn] },
]
export default function BottomNav({ active }: { active: NavKey }) {
  return (
    <>
      <View className='bn-spacer' />
      <View className='bn'>
        {ITEMS.map((it) => {
          const on = it.key === active
          const go = () => { if (!on) Taro.redirectTo({ url: it.url }) }
          if (it.center) return (
            <View key={it.key} className={'bn-c' + (on ? ' on' : '')} onClick={go}>
              {on && <View className='bn-halo' />}
              <View className='bn-ring'><View className='bn-core'><Image src={it.icon[on ? 1 : 0]} className={on ? 'bn-ball-on' : 'bn-ico'} /></View></View>
              <Text className={'bn-l' + (on ? ' on' : '')}>{it.label}</Text>
            </View>
          )
          return (
            <View key={it.key} className='bn-i' onClick={go}>
              <Image src={it.icon[on ? 1 : 0]} className='bn-ico' />
              <Text className={'bn-l' + (on ? ' on' : '')}>{it.label}</Text>
            </View>
          )
        })}
      </View>
    </>
  )
}
