# CLI 重构计划：拆分同步命令并支持日志抽取

## 📋 需求分析

### 当前状态
- CLI 已经支持单独执行每个表的同步（`python cli.py teams`）
- 但命令结构可以进一步优化
- 需要支持通过日志进行追踪和抽取

### 目标
1. **每个表一个独立命令**：每个同步操作都可以通过一条命令执行
2. **结构化日志**：所有日志都可以被程序化抽取和分析
3. **单场比赛同步**：games 表需要支持同步单场比赛的命令

---

## 🎯 命令设计

### 基础命令（每个表一个）

```bash
# 同步 teams 表
python cli.py sync-teams

# 同步 team_standings 表
python cli.py sync-team-standings

# 同步 players 表
python cli.py sync-players

# 同步 player_season_stats 表
python cli.py sync-player-stats

# 同步 games 表（默认：昨天和今天的比赛）
python cli.py sync-games

# 同步 game_player_stats 表（需要 game_id）
python cli.py sync-game-stats --game-id 0022500009
```

### Games 表的特殊命令

```bash
# 同步单场比赛（只同步 games 表，不包含 player stats）
python cli.py sync-game --game-id 0022500009

# 同步指定日期的比赛
python cli.py sync-games --date 2025-01-06

# 同步指定日期范围的比赛
python cli.py sync-games --start-date 2025-01-01 --end-date 2025-01-31

# 同步昨天的比赛
python cli.py sync-games --yesterday

# 同步今天的比赛
python cli.py sync-games --today
```

---

## 📝 日志设计

### 日志格式要求

所有日志需要：
1. **结构化输出**：JSON 格式（可选，通过 `--json` 参数）
2. **可抽取的关键信息**：
   - 命令名称
   - 执行时间
   - 成功/失败状态
   - 同步的记录数
   - 错误信息（如果有）

### 日志输出示例

#### 标准输出（人类可读）
```
[2025-01-06 20:30:15] [SYNC] Starting sync-teams
[2025-01-06 20:30:16] [INFO] Current NBA season: 2024-25
[2025-01-06 20:30:18] [INFO] Fetched 30 teams from NBA API
[2025-01-06 20:30:20] [SUCCESS] Synced 30 teams to database
[2025-01-06 20:30:20] [SYNC] Completed sync-teams (duration: 5.2s)
```

#### JSON 输出（机器可读，通过 `--json` 参数）
```json
{
  "timestamp": "2025-01-06T20:30:15Z",
  "command": "sync-teams",
  "status": "success",
  "duration_seconds": 5.2,
  "records_synced": 30,
  "errors": []
}
```

---

## 🏗️ 实现方案

### 1. 日志模块 (`app/utils/logger.py`)

创建统一的日志工具，支持：
- 结构化日志（JSON）
- 标准输出日志（人类可读）
- 日志级别（DEBUG, INFO, SUCCESS, WARNING, ERROR）
- 可抽取的关键信息

```python
# app/utils/logger.py
import json
import sys
from datetime import datetime
from typing import Optional, Dict, Any

class SyncLogger:
    """结构化日志记录器，支持 JSON 和标准输出"""
    
    def __init__(self, json_mode: bool = False):
        self.json_mode = json_mode
        self.logs = []
    
    def log(self, level: str, message: str, **kwargs):
        """记录日志"""
        timestamp = datetime.utcnow().isoformat() + "Z"
        
        if self.json_mode:
            log_entry = {
                "timestamp": timestamp,
                "level": level,
                "message": message,
                **kwargs
            }
            print(json.dumps(log_entry))
        else:
            # 人类可读格式
            time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(f"[{time_str}] [{level}] {message}")
        
        self.logs.append({
            "timestamp": timestamp,
            "level": level,
            "message": message,
            **kwargs
        })
    
    def info(self, message: str, **kwargs):
        self.log("INFO", message, **kwargs)
    
    def success(self, message: str, **kwargs):
        self.log("SUCCESS", message, **kwargs)
    
    def error(self, message: str, **kwargs):
        self.log("ERROR", message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        self.log("WARNING", message, **kwargs)
```

### 2. 命令结构重构

#### 选项 A：使用 Click 库（推荐）

```python
# cli.py
import click
from app.utils.logger import SyncLogger

@click.group()
@click.option('--json', is_flag=True, help='Output logs in JSON format')
@click.pass_context
def cli(ctx, json):
    """NBA Data Synchronization CLI"""
    ctx.ensure_object(dict)
    ctx.obj['logger'] = SyncLogger(json_mode=json)

@cli.command('sync-teams')
@click.pass_context
def sync_teams(ctx):
    """Sync teams table"""
    logger = ctx.obj['logger']
    logger.info("Starting sync-teams")
    # ... 调用同步函数
    logger.success("Completed sync-teams", records_synced=30)

@cli.command('sync-game')
@click.option('--game-id', required=True, help='NBA game ID')
@click.pass_context
def sync_game(ctx, game_id):
    """Sync a single game"""
    logger = ctx.obj['logger']
    logger.info("Starting sync-game", game_id=game_id)
    # ... 调用同步函数
    logger.success("Completed sync-game", game_id=game_id)
```

#### 选项 B：使用 argparse（保持现有方式）

保持现有 argparse 结构，但添加日志功能。

### 3. 单场比赛同步功能

需要在 `game_service.py` 中添加新函数：

```python
def sync_single_game(game_id: str) -> None:
    """
    Sync a single game by game ID.
    
    Args:
        game_id: NBA game ID (e.g., '0022500009')
    """
    # 1. 从 NBA API 获取单场比赛数据
    # 2. 转换数据格式
    # 3. Upsert 到 games 表
    pass
```

---

## 📦 文件结构

```
py-data-sync-service/
├── cli.py                          # 重构后的 CLI 入口
├── app/
│   ├── utils/
│   │   ├── __init__.py
│   │   └── logger.py              # 结构化日志工具
│   └── commands/                  # 命令实现（可选，用于更好的组织）
│       ├── __init__.py
│       ├── teams.py
│       ├── games.py
│       └── ...
└── services/                      # 现有同步服务（保持不变）
    └── ...
```

---

## 🔧 实施步骤

### Phase 1: 日志模块
- [ ] 创建 `app/utils/logger.py`
- [ ] 实现结构化日志（JSON 和标准输出）
- [ ] 测试日志功能

### Phase 2: CLI 重构
- [ ] 重构 `cli.py`，使用新的日志系统
- [ ] 确保每个命令都有清晰的日志输出
- [ ] 添加 `--json` 参数支持

### Phase 3: 单场比赛同步
- [ ] 在 `game_service.py` 中添加 `sync_single_game()` 函数
- [ ] 在 CLI 中添加 `sync-game` 命令
- [ ] 测试单场比赛同步功能

### Phase 4: 日志抽取工具（可选）
- [ ] 创建日志解析工具
- [ ] 支持从日志文件中提取关键信息
- [ ] 生成同步报告

---

## 📊 日志抽取示例

### 从标准输出提取
```bash
python cli.py sync-teams 2>&1 | grep "\[SUCCESS\]" | awk '{print $4}'
```

### 从 JSON 输出提取
```bash
python cli.py sync-teams --json | jq '.records_synced'
```

### 生成同步报告
```bash
python cli.py sync-teams --json > sync.log
python scripts/parse_sync_log.py sync.log
```

---

## ✅ 验收标准

1. **每个表一个命令**
   - [ ] `sync-teams` 可以单独执行
   - [ ] `sync-team-standings` 可以单独执行
   - [ ] `sync-players` 可以单独执行
   - [ ] `sync-player-stats` 可以单独执行
   - [ ] `sync-games` 可以单独执行
   - [ ] `sync-game-stats` 可以单独执行

2. **单场比赛同步**
   - [ ] `sync-game --game-id XXX` 可以同步单场比赛
   - [ ] 只同步 games 表，不包含 player stats

3. **日志功能**
   - [ ] 标准输出模式：人类可读
   - [ ] JSON 模式：机器可读
   - [ ] 关键信息可抽取（命令、状态、记录数、耗时）

4. **向后兼容**
   - [ ] 现有的命令仍然可用（或提供迁移指南）
   - [ ] 不破坏现有功能

---

## 🚀 快速开始

实施后，使用方式：

```bash
# 标准模式（人类可读日志）
python cli.py sync-teams

# JSON 模式（机器可读日志）
python cli.py sync-teams --json

# 同步单场比赛
python cli.py sync-game --game-id 0022500009

# 同步指定日期的比赛
python cli.py sync-games --date 2025-01-06
```

---

## ❓ 待确认问题

1. **是否使用 Click 库？**
   - 优点：更现代的 CLI 框架，更好的帮助信息
   - 缺点：需要添加新依赖
   - 或者：继续使用 argparse，但改进结构

2. **日志格式偏好？**
   - 标准输出格式（人类可读）
   - JSON 格式（机器可读）
   - 两者都支持（通过参数切换）

3. **单场比赛同步的范围？**
   - 只同步 games 表？
   - 还是同时同步 game_player_stats？

---

**下一步**：确认方案后，开始实施。
