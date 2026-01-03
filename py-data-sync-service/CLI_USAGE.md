# CLI 使用示例

本文档展示如何使用 `cli.py` 命令行工具来同步 NBA 数据。

## 基本用法

### 1. 查看帮助信息

```bash
python cli.py --help
```

### 2. 查看所有可用命令

```bash
python cli.py --list
```

## 使用示例

### 示例 1: 只同步团队数据

```bash
python cli.py teams
```

**输出示例：**
```
============================================================
NBA Data Synchronization CLI
============================================================
Commands to execute: teams
============================================================

[1/1] Executing: teams
------------------------------------------------------------
============================================================
Syncing Teams
============================================================
Starting team sync...
Current NBA season: 2024-25
Fetching data from NBA API (LeagueStandings)...
...
✅ Team sync completed successfully!
```

### 示例 2: 同步多个数据源

```bash
python cli.py teams players
```

这会先同步团队数据，然后同步球员数据。

### 示例 3: 同步游戏数据（赛程和结果）

```bash
python cli.py games
```

这会同步：
- US "Yesterday" 的比赛（东京 "Today" - 主要是已完成的比赛）
- US "Today" 的比赛（东京 "Tomorrow" - 主要是预定的比赛）

### 示例 4: 同步所有数据

```bash
python cli.py --all
```

这会按顺序同步所有数据：
1. teams
2. team-standings
3. players
4. stats
5. games

**注意：** 建议先同步 `teams`，因为其他数据（players, games）依赖于 teams 表。

### 示例 5: 组合多个命令

```bash
python cli.py teams team-standings players
```

这会按顺序执行：
1. 同步团队
2. 同步团队排名
3. 同步球员

### 示例 6: 只同步统计数据

```bash
python cli.py stats
```

这会同步球员赛季统计数据。

### 示例 7: 同步特定比赛的球员统计数据

```bash
python cli.py game-player-stats --game-id 0022500009
```

这会同步指定比赛的球员统计数据到 `game_player_stats` 表。

**参数说明：**
- `--game-id`: 必需参数，NBA 比赛 ID（例如：`0022500009`）

**输出示例：**
```
============================================================
NBA Data Synchronization CLI
============================================================
Commands to execute: game-player-stats
Game ID: 0022500009
============================================================

[1/1] Executing: game-player-stats
------------------------------------------------------------
============================================================
Syncing Game Player Stats for Game 0022500009
============================================================
Starting game player stats sync for game 0022500009...
Fetching player stats for game 0022500009 from NBA API...
...
✅ Game player stats sync completed successfully for game 0022500009!
```

**注意：**
- 这个命令需要提供 `--game-id` 参数，否则会报错
- 比赛必须已经完成或正在进行中，才能获取到球员统计数据
- 如果比赛还未开始，API 可能返回空数据

## 常见使用场景

### 场景 1: 首次设置数据库

```bash
# 1. 先同步团队（其他数据依赖于此）
python cli.py teams

# 2. 然后同步球员
python cli.py players

# 3. 同步团队排名
python cli.py team-standings

# 4. 同步球员统计数据
python cli.py stats
```

### 场景 2: 每日更新游戏数据

```bash
# 每天运行一次，更新游戏数据
python cli.py games
```

### 场景 3: 更新所有数据

```bash
# 一次性更新所有数据
python cli.py --all
```

### 场景 4: 只更新特定数据

```bash
# 只更新团队排名（不更新其他数据）
python cli.py team-standings
```

### 场景 5: 同步特定比赛的球员统计数据

```bash
# 同步某场比赛的球员统计数据（比赛结束后）
python cli.py game-player-stats --game-id 0022500009
```

**使用场景：**
- 比赛结束后，需要获取该场比赛的详细球员统计数据
- 用于更新 fantasy score 和比赛详情
- 可以批量处理多场比赛（需要多次运行命令）

**获取 game_id：**
- 可以从 `games` 表中查询已完成的比赛
- 或者从 NBA 官网的比赛页面 URL 中获取

## 错误处理

如果某个命令执行失败，CLI 会：

1. **显示错误信息**：打印详细的错误堆栈
2. **询问是否继续**：如果有其他命令待执行，会询问是否继续
3. **显示摘要**：最后显示成功和失败的命令数量

**示例：**
```
[1/3] Executing: teams
------------------------------------------------------------
✅ teams completed successfully

[2/3] Executing: players
------------------------------------------------------------
❌ Error during players: Connection timeout

Continue with remaining commands? (y/n): y

[3/3] Executing: games
------------------------------------------------------------
✅ games completed successfully

============================================================
Sync Summary
============================================================
Total commands executed: 3
Successful: 2
Failed: 1
Failed commands: players
```

## 退出代码

- `0`: 所有命令成功执行
- `1`: 有命令执行失败
- `130`: 用户中断（Ctrl+C）

## 注意事项

1. **依赖关系**：
   - `players` 和 `games` 依赖于 `teams`
   - `game-player-stats` 依赖于 `players` 和 `teams`（需要验证外键）
   - 建议先同步 `teams`，再同步其他数据

2. **幂等性**：
   - 所有同步操作都是幂等的
   - 可以安全地多次运行同一个命令，不会创建重复数据

3. **环境变量**：
   - 确保已设置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`
   - 可以通过 `.env.development` 或 `.env.production` 文件设置

4. **网络连接**：
   - 需要能够访问 NBA API 和 Supabase
   - 如果网络不稳定，CLI 会自动重试（最多 3 次）

## 与 Lambda 的区别

- **`handler.py`**: 用于 AWS Lambda，会先清空所有表，然后同步所有数据
- **`cli.py`**: 用于手动控制，可以选择性同步，不会清空表（使用 upsert）

## 更多帮助

运行以下命令查看详细帮助：

```bash
python cli.py --help
```

