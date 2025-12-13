# 项目结构文档

## 目录结构

```
src/
├── components/              # 组件目录
│   ├── layout/             # 布局组件
│   │   ├── Header.tsx      # 统一顶部导航栏（支持多种配置）
│   │   └── BottomNav.tsx   # 底部导航栏
│   │
│   ├── leaderboard/        # 排行榜相关组件
│   │   ├── LeaderboardPage.tsx     # 排行榜主页面
│   │   ├── LeaderboardList.tsx     # 排行榜列表
│   │   └── LeaderboardSidebar.tsx  # 左侧过滤器
│   │
│   ├── lineup/             # 阵容选择相关组件
│   │   ├── BasketballCourt.tsx     # 篮球场组件
│   │   ├── NeonCourtOverlay.tsx    # 霓虹灯球场叠加层
│   │   └── PlayerCard.tsx          # 球员卡片（可点击跳转）
│   │
│   ├── player/             # 球员详情相关组件
│   │   ├── PlayerDetailView.tsx    # 球员详情视图
│   │   ├── ClutchTimeChart.tsx     # Clutch Time 表现图表
│   │   ├── ShotChart.tsx           # 投篮热力图
│   │   └── LeagueComparisonRadar.tsx # 联盟对比雷达图
│   │
│   ├── team/               # 球队详情相关组件
│   │   ├── TeamDetailView.tsx      # 球队详情视图
│   │   ├── PlayerStatCard.tsx      # 球员统计卡片（可点击）
│   │   ├── CircularProgress.tsx    # 圆形进度条
│   │   ├── LineChart.tsx           # 折线图
│   │   ├── HorizontalProgress.tsx  # 水平进度条
│   │   └── RadarChart.tsx          # 雷达图
│   │
│   ├── ui/                 # UI 基础组件
│   │   └── tabs.tsx        # Shadcn UI Tabs 组件
│   │
│   └── features/           # 功能组件（预留）
│
├── pages/                  # 页面组件
│   ├── HomePage.tsx        # 首页
│   ├── LeaguesPage.tsx     # 联赛页面（使用 LeaderboardPage）
│   ├── LineupPage.tsx      # 阵容选择页面
│   ├── MatchupsPage.tsx    # 对战页面
│   ├── ProfilePage.tsx     # 个人资料页面
│   ├── TeamDetailPage.tsx  # 球队详情页面
│   └── PlayerDetailPage.tsx # 球员详情页面
│
├── hooks/                  # 自定义 React Hooks（预留）
├── store/                  # Zustand 状态管理（预留）
├── lib/                    # 工具函数
│   └── utils.ts            # 工具函数（cn 等）
├── types/                  # TypeScript 类型定义
│   └── index.ts            # 所有类型定义
└── styles/                 # 全局样式
    └── index.css           # Tailwind + 自定义样式
```

## 页面 Header 使用规范

### Header 组件特性

所有页面统一使用 `src/components/layout/Header.tsx` 组件，支持以下配置：

```typescript
interface HeaderProps {
  title: string;              // 页面标题
  showBack?: boolean;         // 显示返回按钮
  showSettings?: boolean;     // 显示设置按钮
  showSearch?: boolean;       // 显示搜索按钮
  showShare?: boolean;        // 显示分享按钮
  showMore?: boolean;         // 显示更多选项按钮
  rightActions?: ReactNode;   // 自定义右侧操作区
  onBack?: () => void;        // 自定义返回处理
  onSettings?: () => void;    // 自定义设置处理
  // ... 其他回调
}
```

### 各页面 Header 配置

| 页面 | Header 配置 | 说明 |
|------|------------|------|
| **HomePage** | `title="Home"` | 基础标题，无操作按钮 |
| **LeaguesPage** | `title="Leaderboard"`, `showSettings` | 显示设置按钮 |
| **LineupPage** | `title="My Lineup Selection"`, `showBack`, `showSettings` | 返回 + 设置 |
| **MatchupsPage** | `title="Matchups"` | 基础标题 |
| **ProfilePage** | `title="Profile"`, `showSettings` | 显示设置按钮 |
| **TeamDetailPage** | `title="Team Roster & Stats"`, `showBack`, `showSearch` | 返回 + 搜索 |
| **PlayerDetailPage** | `title="Player Profile"`, `showBack`, `showShare`, `showMore` | 返回 + 分享 + 更多 |

### Header 布局规范

- **高度**: 固定 60px (`h-[60px]`)
- **位置**: Fixed top (`fixed top-0`)
- **背景**: 半透明黑色 + 模糊效果 (`bg-brand-dark/80 backdrop-blur-sm`)
- **内容区域**: 使用 `pt-[60px]` 预留 header 空间
- **底部导航**: 使用 `pb-[90px]` 预留底部导航空间

## 页面布局规范

### 标准页面布局

```tsx
<div className="max-w-md mx-auto min-h-screen flex flex-col">
  <Header title="Page Title" showBack showSettings />
  <div className="flex-1 overflow-y-auto pt-[60px] pb-[90px]">
    {/* 页面内容 */}
  </div>
</div>
```

### 详情页面布局

```tsx
<div className="flex flex-col h-full max-w-md mx-auto">
  <Header title="Detail Page" showBack showSearch />
  <div className="flex-1 overflow-y-auto pt-[60px] pb-4">
    {/* 详情内容 */}
  </div>
</div>
```

## 路由结构

```
/ → 重定向到 /lineup
/home → HomePage
/leagues → LeaguesPage (LeaderboardPage)
/lineup → LineupPage
/matchups → MatchupsPage
/profile → ProfilePage
/team/:teamId → TeamDetailPage
/player/:playerId → PlayerDetailPage
```

## 类型定义

主要类型位于 `src/types/index.ts`:

- `Player` - 基础球员信息
- `PlayerDetail` - 球员详情（包含统计数据）
- `Team` - 基础球队信息
- `TeamDetail` - 球队详情（包含球员列表）
- `LeaderboardEntry` - 排行榜条目
- `LeaderboardFilter` - 排行榜过滤器类型

## 组件交互流程

### 导航流程

1. **排行榜 → 球队详情**: 点击球队条目 → `/team/:teamId`
2. **排行榜 → 球员详情**: 点击球员条目 → `/player/:playerId`
3. **阵容选择 → 球员详情**: 点击球员卡片 → `/player/:playerId`
4. **球队详情 → 球员详情**: 点击球员统计卡片 → `/player/:playerId`

### 状态管理

- 当前使用组件内部状态 (`useState`)
- 预留 `src/store/` 目录用于 Zustand 状态管理
- 可扩展全局状态（如用户信息、收藏列表等）

## 样式系统

### 品牌颜色

- `brand-dark`: `#0D121D` - 主背景色
- `brand-blue`: `#6EE2F5` - 主强调色
- `brand-orange`: `#F5A623` - 次要强调色
- `brand-card`: `rgba(29, 39, 61, 0.5)` - 卡片背景
- `brand-text-light`: `#E0EFFF` - 主要文本
- `brand-text-dim`: `#7A8B99` - 次要文本

### 响应式设计

- 移动端优先（`max-w-md`）
- 固定最大宽度适应移动屏幕
- 使用 `flex` 和 `overflow-y-auto` 实现滚动

## 开发规范

1. **组件命名**: PascalCase，文件名与组件名一致
2. **类型定义**: 统一在 `types/index.ts` 管理
3. **样式**: 优先使用 Tailwind CSS，复杂样式使用 CSS Modules 或全局样式
4. **路由**: 使用 React Router DOM v6
5. **代码风格**: TypeScript 严格模式，ESLint 检查

