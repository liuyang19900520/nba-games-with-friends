export default defineAppConfig({
  pages: [
    'pages/index/index', 'pages/standings/index', 'pages/leaders/index', 'pages/more/index',
    'pages/leaderlist/index', 'pages/team/index', 'pages/player/index', 'pages/game/index',
  ],
  window: { navigationBarBackgroundColor: '#0D121D', navigationBarTextStyle: 'white', navigationBarTitleText: 'NBA', backgroundColor: '#0D121D', backgroundTextStyle: 'light' },
  tabBar: {
    color: '#7A8B99', selectedColor: '#6EE2F5', backgroundColor: '#0D121D', borderStyle: 'black',
    list: [
      { pagePath: 'pages/index/index', iconPath: 'assets/tab-games.png', selectedIconPath: 'assets/tab-games-on.png', text: '赛程' },
      { pagePath: 'pages/standings/index', iconPath: 'assets/tab-standings.png', selectedIconPath: 'assets/tab-standings-on.png', text: '球队榜' },
      { pagePath: 'pages/leaders/index', iconPath: 'assets/tab-leaders.png', selectedIconPath: 'assets/tab-leaders-on.png', text: '球员榜' },
      { pagePath: 'pages/more/index', iconPath: 'assets/tab-more.png', selectedIconPath: 'assets/tab-more-on.png', text: '数据' },
    ],
  },
})
