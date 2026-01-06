# 新版 CLI 使用指南

## 📋 概述

新版 CLI 使用新的命令结构，每个表一个独立命令，并支持 JSON 日志输出。

## 🚀 基本用法

### 查看帮助

```bash
python cli.py --help
```

### 标准模式（人类可读日志）

```bash
# 同步 teams 表
python cli.py sync-teams

# 同步 team_standings 表
python cli.py sync-team-standings

# 同步 players 表
python cli.py sync-players

# 同步 player_season_stats 表
python cli.py sync-player-stats

# 同步 games 表（昨天和今天的比赛）
python cli.py sync-games
```

### JSON 模式（机器可读，便于日志抽取）

```bash
# 同步 teams 表，输出 JSON 格式日志
python cli.py sync-teams --json

# 将 JSON 日志保存到文件
python cli.py sync-teams --json > sync.log

# 从 JSON 日志中提取关键信息
python cli.py sync-teams --json | jq '.records_synced'
python cli.py sync-teams --json | jq '.duration_seconds'
```

## 🎮 单场比赛同步

### 同步单场比赛（games + game_player_stats）

```bash
# 同步单场比赛（同时同步 games 表和 game_player_stats 表）
python cli.py sync-game --game-id 0022500009

# JSON 模式
python cli.py sync-game --game-id 0022500009 --json
```

**功能说明**：
- 从 NBA API 获取比赛基本信息
- 同步到 `games` 表
- 同步球员统计数据到 `game_player_stats` 表

### 只同步球员统计数据

```bash
# 只同步 game_player_stats 表（不更新 games 表）
python cli.py sync-game-stats --game-id 0022500009

# JSON 模式
python cli.py sync-game-stats --game-id 0022500009 --json
```

## 📊 日志格式

### 标准输出模式（人类可读）

```
[2025-01-06 20:30:15] [SYNC] Starting sync-teams
[2025-01-06 20:30:16] [INFO] Current NBA season: 2024-25
[2025-01-06 20:30:18] [INFO] Fetched 30 teams from NBA API
[2025-01-06 20:30:20] [SUCCESS] Synced 30 teams to database
[2025-01-06 20:30:20] [SUCCESS] Completed sync-teams
  duration_seconds: 5.2

============================================================
Sync Summary
============================================================
Command: sync-teams
Status: success
Duration: 5.2s
Records synced: 30
```

### JSON 输出模式（机器可读）

```json
{"timestamp": "2025-01-06T20:30:15Z", "level": "SYNC", "message": "Starting sync-teams", "command": "sync-teams"}
{"timestamp": "2025-01-06T20:30:16Z", "level": "INFO", "message": "Current NBA season: 2024-25", "command": "sync-teams"}
{"timestamp": "2025-01-06T20:30:18Z", "level": "INFO", "message": "Fetched 30 teams from NBA API", "command": "sync-teams"}
{"timestamp": "2025-01-06T20:30:20Z", "level": "SUCCESS", "message": "Synced 30 teams to database", "command": "sync-teams", "records_synced": 30}
{"timestamp": "2025-01-06T20:30:20Z", "level": "SUCCESS", "message": "Completed sync-teams", "command": "sync-teams", "duration_seconds": 5.2, "status": "success"}
```

## 🔍 日志抽取示例

### 使用 jq 提取信息

```bash
# 提取所有成功日志
python cli.py sync-teams --json | jq 'select(.level == "SUCCESS")'

# 提取同步的记录数
python cli.py sync-teams --json | jq 'select(.records_synced != null) | .records_synced'

# 提取执行时间
python cli.py sync-teams --json | jq 'select(.duration_seconds != null) | .duration_seconds'

# 提取错误信息
python cli.py sync-teams --json | jq 'select(.level == "ERROR") | .message'
```

### 使用 grep 和 awk（标准输出模式）

```bash
# 提取成功消息
python cli.py sync-teams 2>&1 | grep "\[SUCCESS\]"

# 提取记录数
python cli.py sync-teams 2>&1 | grep "records_synced" | awk '{print $NF}'
```

## 📝 命令对比

### 旧版命令 → 新版命令

| 旧版 | 新版 | 说明 |
|------|------|------|
| `python cli.py teams` | `python cli.py sync-teams` | 同步 teams 表 |
| `python cli.py team-standings` | `python cli.py sync-team-standings` | 同步 team_standings 表 |
| `python cli.py players` | `python cli.py sync-players` | 同步 players 表 |
| `python cli.py stats` | `python cli.py sync-player-stats` | 同步 player_season_stats 表 |
| `python cli.py games` | `python cli.py sync-games` | 同步 games 表 |
| `python cli.py game-player-stats --game-id XXX` | `python cli.py sync-game-stats --game-id XXX` | 同步 game_player_stats 表 |
| - | `python cli.py sync-game --game-id XXX` | **新增**：同步单场比赛（games + game_player_stats） |

## ✅ 主要改进

1. **统一的命令命名**：所有命令都以 `sync-` 开头
2. **JSON 日志支持**：通过 `--json` 参数启用机器可读的日志格式
3. **单场比赛同步**：新增 `sync-game` 命令，同时同步 games 和 game_player_stats
4. **结构化日志**：所有日志都包含时间戳、级别、命令等元数据
5. **更好的错误处理**：错误信息包含在日志中，便于追踪

## 🔧 使用场景

### 场景 1: 每日数据同步

```bash
# 同步所有基础数据
python cli.py sync-teams
python cli.py sync-players
python cli.py sync-games

# 同步比赛结果（如果有新完成的比赛）
python cli.py sync-game --game-id 0022500009
```

### 场景 2: 日志监控和分析

```bash
# 将同步日志保存到文件
python cli.py sync-teams --json > sync_teams_$(date +%Y%m%d).log

# 分析日志
cat sync_teams_*.log | jq 'select(.level == "ERROR")' | wc -l  # 统计错误数
cat sync_teams_*.log | jq 'select(.duration_seconds != null) | .duration_seconds' | awk '{sum+=$1} END {print sum/NR}'  # 平均执行时间
```

### 场景 3: 自动化脚本

```bash
#!/bin/bash
# 同步脚本示例

GAME_ID="0022500009"

# 同步单场比赛
python cli.py sync-game --game-id "$GAME_ID" --json > "sync_game_${GAME_ID}.log"

# 检查是否成功
if grep -q '"status":"success"' "sync_game_${GAME_ID}.log"; then
    echo "✅ Game $GAME_ID synced successfully"
else
    echo "❌ Failed to sync game $GAME_ID"
    exit 1
fi
```

## 📚 更多信息

- 查看完整帮助：`python cli.py --help`
- 查看特定命令帮助：`python cli.py sync-teams --help`
