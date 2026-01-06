# FastAPI 迁移计划：将同步功能暴露为 API

## 📋 项目目标

将现有的数据同步服务（`services/` 目录下的同步函数）通过 FastAPI 暴露为 HTTP API，允许通过 API 调用触发数据同步操作。

**核心需求**：
- ✅ 通过 API 调用触发同步操作（不是传统的 CRUD API）
- ✅ 符合 FastAPI 最佳实践
- ✅ 保持现有同步逻辑不变
- ✅ 支持异步执行和状态查询
- ✅ 提供详细的同步结果反馈

---

## 🏗️ 项目结构

```
py-data-sync-service/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI 应用入口
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py              # 配置管理（复用现有 config.py 逻辑）
│   │   └── dependencies.py       # 共享依赖（如 get_db）
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py          # API 路由聚合
│   │       └── endpoints/
│   │           ├── __init__.py
│   │           ├── sync.py         # 同步操作端点
│   │           └── status.py      # 同步状态查询端点（可选）
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── sync.py                # Pydantic 模型：请求/响应
│   │   └── common.py              # 通用响应模型
│   ├── services/                  # 复用现有的同步服务
│   │   ├── __init__.py
│   │   └── (现有文件保持不变)
│   └── utils/                     # 工具函数（复用现有 utils.py）
│       └── (可选：如果需要包装)
└── requirements.txt               # 添加 fastapi, uvicorn
```

---

## 🔌 API 端点设计

### 1. 同步端点 (`/api/v1/sync/`)

#### 1.1 同步所有数据
```
POST /api/v1/sync/all
```
- **功能**：触发完整的数据同步（teams → standings → players → stats → games）
- **请求体**：可选参数（如 `truncate: bool = False`）
- **响应**：同步任务 ID 和状态

#### 1.2 同步特定资源
```
POST /api/v1/sync/teams
POST /api/v1/sync/team-standings
POST /api/v1/sync/players
POST /api/v1/sync/player-stats
POST /api/v1/sync/games
POST /api/v1/sync/game-details
```
- **功能**：触发单个资源的同步
- **请求体**：可选参数（如日期、赛季等）
- **响应**：同步结果详情

#### 1.3 批量同步
```
POST /api/v1/sync/batch
```
- **功能**：同时触发多个资源的同步
- **请求体**：`{"resources": ["teams", "players"], ...}`
- **响应**：每个资源的同步结果

### 2. 状态查询端点（可选，用于长时间运行的任务）

```
GET /api/v1/sync/status/{task_id}
GET /api/v1/sync/history
```

---

## 📦 数据模型设计

### 请求模型 (Pydantic Schemas)

```python
# app/schemas/sync.py

class SyncRequest(BaseModel):
    """通用同步请求模型"""
    truncate: bool = False  # 是否在同步前清空表
    force: bool = False     # 是否强制同步（即使数据已存在）

class SyncAllRequest(SyncRequest):
    """同步所有数据的请求"""
    pass

class SyncGamesRequest(SyncRequest):
    """同步游戏的请求"""
    day_offset: Optional[int] = -1  # 日期偏移（-1=昨天，0=今天，1=明天）
    start_date: Optional[str] = None  # 开始日期（YYYY-MM-DD）
    end_date: Optional[str] = None    # 结束日期（YYYY-MM-DD）

class SyncBatchRequest(BaseModel):
    """批量同步请求"""
    resources: List[str]  # ["teams", "players", ...]
    truncate: bool = False
```

### 响应模型

```python
class SyncResponse(BaseModel):
    """同步操作响应"""
    success: bool
    message: str
    resource: str  # "teams", "players", etc.
    records_synced: Optional[int] = None
    duration_seconds: Optional[float] = None
    errors: List[str] = []

class SyncAllResponse(BaseModel):
    """同步所有数据的响应"""
    success: bool
    message: str
    results: Dict[str, SyncResponse]  # 每个资源的同步结果
    total_duration_seconds: float
```

---

## 🎯 实现步骤

### Phase 1: 基础架构搭建

1. **创建项目结构**
   - [ ] 创建 `app/` 目录结构
   - [ ] 创建 `app/core/config.py`（复用现有配置逻辑）
   - [ ] 创建 `app/main.py`（FastAPI 应用入口）
   - [ ] 创建 `app/api/v1/router.py`（路由聚合）

2. **定义数据模型**
   - [ ] 创建 `app/schemas/sync.py`（请求/响应模型）
   - [ ] 创建 `app/schemas/common.py`（通用响应模型）

3. **更新依赖**
   - [ ] 更新 `requirements.txt`（添加 `fastapi`, `uvicorn`）

### Phase 2: 同步端点实现

4. **实现同步端点**
   - [ ] 创建 `app/api/v1/endpoints/sync.py`
   - [ ] 实现 `POST /api/v1/sync/teams`
   - [ ] 实现 `POST /api/v1/sync/team-standings`
   - [ ] 实现 `POST /api/v1/sync/players`
   - [ ] 实现 `POST /api/v1/sync/player-stats`
   - [ ] 实现 `POST /api/v1/sync/games`
   - [ ] 实现 `POST /api/v1/sync/game-details`
   - [ ] 实现 `POST /api/v1/sync/all`
   - [ ] 实现 `POST /api/v1/sync/batch`

5. **错误处理**
   - [ ] 统一异常处理中间件
   - [ ] 自定义异常类
   - [ ] 错误响应格式化

### Phase 3: 增强功能（可选）

6. **异步任务支持**（如果需要）
   - [ ] 集成 Celery 或 BackgroundTasks
   - [ ] 实现任务状态查询端点

7. **认证和授权**（如果需要）
   - [ ] API Key 认证
   - [ ] JWT 认证

8. **日志和监控**
   - [ ] 结构化日志
   - [ ] 请求/响应日志中间件
   - [ ] 健康检查端点

### Phase 4: 测试和文档

9. **测试**
   - [ ] 单元测试
   - [ ] 集成测试

10. **文档**
    - [ ] API 文档（FastAPI 自动生成）
    - [ ] 使用示例
    - [ ] 部署指南

---

## 🔧 技术细节

### 1. 同步服务包装

现有的同步函数（如 `sync_teams()`）直接打印日志。我们需要：

**选项 A：保持同步函数不变，在 API 层捕获输出**
```python
import io
import sys
from contextlib import redirect_stdout

def sync_teams_api():
    output = io.StringIO()
    with redirect_stdout(output):
        sync_teams()
    return output.getvalue()
```

**选项 B：重构同步函数，返回结构化结果**（推荐）
```python
# 在 API 层包装现有函数
def sync_teams_wrapper() -> SyncResponse:
    try:
        start_time = time.time()
        # 调用现有同步函数
        sync_teams()
        duration = time.time() - start_time
        return SyncResponse(
            success=True,
            message="Teams synced successfully",
            resource="teams",
            duration_seconds=duration
        )
    except Exception as e:
        return SyncResponse(
            success=False,
            message=f"Failed to sync teams: {str(e)}",
            resource="teams",
            errors=[str(e)]
        )
```

### 2. 错误处理策略

```python
# app/core/exceptions.py
class SyncException(Exception):
    """同步操作异常"""
    pass

# app/api/v1/endpoints/sync.py
@router.post("/teams", response_model=SyncResponse)
async def sync_teams_endpoint(request: SyncRequest):
    try:
        # 执行同步
        result = sync_teams_wrapper()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Sync failed: {str(e)}"
        )
```

### 3. 日志处理

- 保持现有的 `print()` 语句（用于控制台输出）
- 添加结构化日志（用于 API 响应）
- 使用 Python `logging` 模块

---

## 📝 API 使用示例

### 同步所有数据
```bash
curl -X POST "http://localhost:8000/api/v1/sync/all" \
  -H "Content-Type: application/json" \
  -d '{"truncate": false}'
```

### 同步特定资源
```bash
curl -X POST "http://localhost:8000/api/v1/sync/teams" \
  -H "Content-Type: application/json" \
  -d '{"truncate": false}'
```

### 同步游戏（指定日期）
```bash
curl -X POST "http://localhost:8000/api/v1/sync/games" \
  -H "Content-Type: application/json" \
  -d '{"day_offset": -1, "truncate": false}'
```

---

## ✅ 验收标准

1. **功能完整性**
   - [ ] 所有现有同步服务都可以通过 API 调用
   - [ ] API 响应包含详细的同步结果
   - [ ] 错误情况得到妥善处理

2. **代码质量**
   - [ ] 符合 FastAPI 最佳实践
   - [ ] 类型提示完整
   - [ ] 代码结构清晰

3. **文档**
   - [ ] Swagger UI 自动生成 API 文档
   - [ ] README 更新使用说明

4. **兼容性**
   - [ ] 现有 CLI 脚本（`main.py`, `handler.py`）仍然可用
   - [ ] 不破坏现有功能

---

## 🚀 实施优先级

**高优先级（MVP）**：
1. 基础架构搭建
2. 单个资源同步端点（teams, players, games）
3. 同步所有数据端点

**中优先级**：
4. 批量同步端点
5. 错误处理和日志

**低优先级（可选）**：
6. 异步任务支持
7. 认证和授权
8. 状态查询端点

---

## 📚 参考资源

- [FastAPI 官方文档](https://fastapi.tiangolo.com/)
- [FastAPI 最佳实践](https://fastapi.tiangolo.com/tutorial/)
- [Pydantic 文档](https://docs.pydantic.dev/)

---

## ❓ 待确认问题

1. **是否需要异步执行？**
   - 同步操作可能需要较长时间，是否需要在后台执行并返回任务 ID？

2. **是否需要认证？**
   - API 是否需要 API Key 或 JWT 认证？

3. **是否需要状态查询？**
   - 是否需要查询历史同步记录和状态？

4. **兼容性要求？**
   - 是否需要保持现有的 CLI 入口（`main.py`, `handler.py`）可用？

---

**下一步**：确认计划后，开始 Phase 1 的实施。
