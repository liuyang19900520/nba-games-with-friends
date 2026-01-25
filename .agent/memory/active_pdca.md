# Active PDCA Log - Living Memory

This file is the **shared memory** between AI agents (Claude Code, Antigravity, Cursor).
When you solve a difficult problem, document it here so other agents don't repeat the same mistakes.

---

## How to Use This File

### When to Add an Entry
- You spent significant time debugging an issue
- You discovered a non-obvious configuration requirement
- You found a workaround for a framework/API limitation
- You encountered an error that wasn't well-documented

### Entry Format
```markdown
### [Date] Issue Title
**Context**: Where/what were you working on?
**Problem**: What went wrong?
**Root Cause**: Why did it happen?
**Solution**: How did you fix it?
**Prevention**: How to avoid this in the future?
```

---

## Recent Lessons Learned & Pitfalls

### [2026-01-24] n8n HTTPS Not Working - Port 443 Blocked
**Context**: Deploying n8n to new AWS Lightsail instance (`nba-cloud-hub-1gb`)
**Problem**: `https://57.182.161.64.nip.io` was unreachable (connection timeout)
**Root Cause**: Lightsail firewall did not have port 443 open. The deployment script `01-create-lightsail.sh` opens ports, but this instance was created differently.
**Solution**:
```bash
aws lightsail open-instance-public-ports \
  --instance-name nba-cloud-hub-1gb \
  --port-info fromPort=443,toPort=443,protocol=tcp \
  --region ap-northeast-1
```
**Prevention**: Always verify firewall rules after creating a new Lightsail instance. Use `aws lightsail get-instance` to check `networking.ports`.

---

### [2026-01-24] n8n 502 Bad Gateway - Wrong Docker Config
**Context**: n8n container was crashing with "connect ECONNREFUSED ::1:5432"
**Problem**: docker-compose.yml was configured for PostgreSQL but `.env` had no DB credentials
**Root Cause**: Someone deployed a Nginx+PostgreSQL config instead of the correct Caddy+SQLite config from `aws/` directory
**Solution**:
1. Stop containers: `docker compose down`
2. Deploy correct config from `infrastructure/n8n/aws/docker-compose.yml`
3. Use external volume to preserve existing workflow data
**Prevention**:
- Always use configs from `infrastructure/n8n/aws/` for production
- The `infrastructure/n8n/` root has legacy Nginx configs - don't use them

---

### [2026-01-24] n8n Workflows Still Exist After Config Change
**Context**: Worried about losing n8n workflows when changing database config
**Problem**: Needed to switch from PostgreSQL config to SQLite
**Root Cause**: N/A - workflows were already stored in SQLite volume
**Solution**: The Docker volume `n8n_n8n_data` contains `database.sqlite` with all workflows. When recreating containers, use `external: true` to preserve the volume.
**Prevention**: Always check `/var/lib/docker/volumes/n8n_n8n_data/_data/` before making database changes.

---

### [2026-01-24] Skills System Restructured for Multi-Agent Sync
**Context**: Using both Antigravity (IDE) and Claude Code (CLI) for the same monorepo
**Problem**: Skills were scattered, no shared memory between agents
**Root Cause**: Original structure had flat SKILL.md files without hierarchy
**Solution**: Created hierarchical skills system:
```
.agent/
├── skills/
│   ├── global/rules.md      # Global rules
│   ├── web/rules.md         # Next.js specific
│   ├── data-sync/rules.md   # Python specific
│   └── n8n/rules.md         # Infrastructure specific
└── memory/
    └── active_pdca.md       # Shared memory (THIS FILE)
```
**Prevention**:
- Entry points: `CLAUDE.md` (Claude Code), `.cursorrules` (Antigravity/Cursor)
- Both point to `.agent/skills/` for hierarchical rules
- Shared memory via `.agent/memory/active_pdca.md`

---

## Archive

> Move old entries here after 30 days to keep the active section focused.

<!-- No archived entries yet -->
