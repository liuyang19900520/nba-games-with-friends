---
description: Technical implementation details for n8n infrastructure
service_path: infrastructure/n8n
tech_stack: [n8n, Docker, Caddy, AWS Lightsail]
type: tech
---

# n8n Technical Implementation

**Infrastructure**: AWS Lightsail (512MB RAM)
**IP**: `57.182.161.64`
**URL**: `https://57.182.161.64.nip.io`

## 1. Architecture details
-   **Reverse Proxy**: Caddy (Auto-HTTPS). Handles SSL termination.
-   **Container Orchestration**: Docker Compose.
-   **Database**: SQLite (local volume `n8n_data`).

## 2. Critical Constraints
> [!WARNING]
> **512MB RAM Limit**: n8n is extremely memory constrained on this instance.
> -   **Do not** use `SplitInBatches` with large datasets inside n8n.
> -   **Do not** enable "Save Execution Progress" for all steps (only on error).
> -   **Do not** run heavy JS transformations. Offload to Python Worker.

## 3. Operational Commands
Located in `infrastructure/n8n/aws/`.

```bash
# SSH Access
ssh -i ~/.ssh/LightsailDefaultKey-ap-northeast-1.pem ubuntu@57.182.161.64

# Deploy / Restart
cd ~/n8n
docker compose down && docker compose up -d

# View Logs
docker logs n8n --tail 100 -f
docker logs caddy --tail 100 -f
```

## 4. Configuration
-   **Credentials**: Stored encrypted in `/n8n_data`. Key is in `config` file.
-   **Env Vars**: `.env` file in `~/n8n/`.
    -   `DB_*` vars should be REMOVED for SQLite mode (only needed for Postgres switch).
    -   `N8N_ENCRYPTION_KEY`: Must match saved key.

## 5. Troubleshooting (Tech)
1.  **n8n 502 Bad Gateway**:
    -   Usually means n8n container crashed (OOM) or is starting up.
    -   Check `docker stats`.
2.  **Caddy Error**:
    -   Check `docker logs caddy`. Ensure ports 80/443 are open in Lightsail Firewall.
3.  **"Connect ECONNREFUSED"**:
    -   Check if n8n is trying to connect to a nonexistent Postgres. Ensure SQLite is used.

## 6. History & Deprecations
-   **Nginx**: REMOVED. Superseded by Caddy. Do not use `nginx` confs.
