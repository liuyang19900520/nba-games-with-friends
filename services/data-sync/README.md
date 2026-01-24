# NBA Data Sync Service

NBA 数据同步服务 - 从 NBA API 同步数据到 Supabase 数据库。

支持与 n8n 工作流集成，以及手动执行进行错误修正。

## 项目结构

```
py-data-sync-service/
├── services/               # 业务逻辑服务
│   ├── game_service.py         # 比赛数据同步
│   ├── game_player_stats_service.py  # 球员比赛数据
│   ├── player_service.py       # 球员基础数据
│   ├── stats_service.py        # 球员赛季统计
│   ├── team_service.py         # 球队数据
│   └── ...
├── check-data/             # 数据校验和修复工具
│   ├── audit_data.py           # 快速健康检查
│   ├── deep_audit.py           # 深度数据审计
│   ├── backfill_data.py        # 批量数据修复
│   └── README.md
├── worker.py               # 后台任务处理器 (n8n 集成)
├── cli.py                  # 命令行工具
├── db.py                   # 数据库连接
├── utils.py                # 工具函数
├── config.py               # 配置管理
├── Dockerfile              # Docker 镜像
├── docker-compose.yml      # Docker Compose 配置
└── requirements.txt        # Python 依赖
```

## 快速开始

### 环境要求

- Python 3.11+
- Docker (可选，用于容器化部署)

### 安装

```bash
# 克隆项目
cd py-data-sync-service

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env.development
# 编辑 .env.development 填入 Supabase 凭证
```

### 配置环境变量

创建 `.env.development` 或 `.env.production` 文件：

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 使用方法

### 1. 命令行工具 (CLI)

```bash
# 查看所有命令
python cli.py --help

# 同步球队数据
python cli.py sync-teams

# 同步指定日期的比赛
python cli.py sync-game --date 2025-01-20 --with-stats

# 同步单场比赛
python cli.py sync-game --game-id 0022500001
```

### 2. 后台 Worker (n8n 集成)

```bash
# 启动后台 worker（轮询 task_queue 表）
python worker.py

# 手动执行任务（用于错误修正）
python worker.py --task SYNC_LIVE_GAME --payload '{"game_ids": ["0022500001"]}'
python worker.py --task SYNC_DATE_GAMES --payload '{"date": "2025-01-20"}'
python worker.py --task DATA_AUDIT
```

#### 支持的任务类型

| 任务类型 | 说明 | Payload 示例 |
|---------|------|-------------|
| `SYNC_LIVE_GAME` | 同步指定比赛 | `{"game_ids": ["0022500001"]}` |
| `SYNC_DATE_GAMES` | 同步指定日期的所有比赛 | `{"date": "2025-01-20"}` |
| `DAILY_WRAP_UP` | 每日汇总数据同步 | `{}` |
| `SYNC_PLAYER_STATS` | 同步球员赛季统计 | `{}` |
| `SYNC_ADVANCED_STATS` | 同步高阶统计 | `{"players": true, "teams": true}` |
| `DATA_AUDIT` | 数据一致性检查 | `{"auto_fix": false}` |
| `BACKFILL_DATA` | 批量数据修复 | `{"start_date": "2025-01-01", "end_date": "2025-01-10"}` |

### 3. 数据校验和修复

```bash
# 快速健康检查
python check-data/audit_data.py

# 深度审计所有表
python check-data/deep_audit.py

# 检查需要修复的数据（不执行）
python check-data/backfill_data.py --check

# 执行数据修复
python check-data/backfill_data.py --phase1  # 比赛数据
python check-data/backfill_data.py --phase2  # 汇总数据
python check-data/backfill_data.py --all     # 全部

# 从中断处恢复
python check-data/backfill_data.py --resume
```

## Docker 部署

### 开发环境

```bash
# 启动开发 worker（支持热重载）
docker-compose --profile dev up nba-worker-dev
```

### 生产环境

```bash
# 构建镜像
docker-compose build

# 启动 worker
docker-compose up -d nba-worker

# 查看日志
docker-compose logs -f nba-worker

# 停止
docker-compose down
```

### 手动执行任务

```bash
# 执行数据审计
docker-compose run --rm nba-task worker.py --task DATA_AUDIT

# 同步指定日期
docker-compose run --rm nba-task worker.py --task SYNC_DATE_GAMES --payload '{"date": "2025-01-20"}'
```

## n8n 工作流集成

Worker 通过轮询 `task_queue` 表来处理任务。n8n 可以通过插入记录到该表来触发任务：

```sql
-- task_queue 表结构
CREATE TABLE task_queue (
    id SERIAL PRIMARY KEY,
    task_type VARCHAR(50) NOT NULL,
    payload JSONB,
    status VARCHAR(20) DEFAULT 'PENDING',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    ended_at TIMESTAMP
);

-- 示例：插入同步任务
INSERT INTO task_queue (task_type, payload)
VALUES ('SYNC_DATE_GAMES', '{"date": "2025-01-20"}');
```

## 时区说明

- 所有时间显示使用 **东京时间 (JST, UTC+9)**
- NBA API 数据使用美国东部时间 (EST/EDT)
- 数据库存储使用 UTC

## 注意事项

### NBA API 限流

NBA API 有请求频率限制 (~20-30 请求/分钟)。本项目已内置：

- 请求间随机延迟 (2-5 秒)
- 指数退避重试机制
- 限流检测和自动等待

如果遇到限流错误：
1. 等待 5-10 分钟
2. 使用 `--resume` 继续

### 数据一致性

运行 `DATA_AUDIT` 任务可以检查：
- 孤立的比赛（过去日期但状态为 Scheduled）
- 缺失比分的 Final 比赛
- 缺失球员统计的 Final 比赛

## License

MIT
