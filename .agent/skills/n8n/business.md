---
description: Business logic and workflow definitions for n8n Automation
service_path: infrastructure/n8n
type: business
---

# n8n Business Logic

**Goal**: Automate NBA game tracking, data syncing, and notifications without manual intervention.

## 1. Workflows

> [!IMPORTANT]
> **Role**: n8n acts as a **Dispatcher/Scheduler**. It DOES NOT process heavy data (handled by Python Worker).

### Core Workflow: `NBA Live Scheduler & Day Wrap-up v2`
- **Schedule**:
    - **Heartbeat**: Runs every 5 seconds to check status.
    - **Active Mode**: If games are live, triggers sync tasks frequently.
    - **Passive Mode**: If no games, runs every 20 minutes to keep system alive.
- **Rules**:
    1.  **Sync Dispatch**:
        -   Start of Game → Insert `SYNC_LIVE_GAME` task.
        -   During Game → Insert `SYNC_LIVE_GAME` task.
    2.  **Notifications (LINE)**:
        -   **First Game**: Send "Game On" message when the first game starts.
        -   **Day Wrap**: Send "Day Completed" message when ALL games are final.
    3.  **Day End**:
        -   Insert `DAILY_WRAP_UP` task to trigger betting calculations and data finalization.

### Error Workflow: `NBA Error Notifier`
- **Trigger**: Any workflow execution failure.
- **Action**: Immediately send LINE message to Admin with:
    -   Workflow Name
    -   Error Node
    -   Error Message
    -   Link to Execution ID

### Callback Workflow: `Task Callback Handler`
- **Trigger**: Webhook from data-sync worker after task completion.
- **Endpoint**: `POST /webhook/task-callback`
- **Action**:
    -   If task FAILED → Send LINE alert with task type, ID, and error message.
    -   If task COMPLETED → No action (silent success).

## 2. Notification Content
-   **Game On**: "🏀 NBA比赛日开始！... 当前进行中: X 场"
-   **Day End**: "🏁 今日NBA比赛全部结束！... 共完成 X 场"
-   **Error**: "🚨 n8n Workflow Error 🚨 ... ⚠️ 工作流已自动停用"
