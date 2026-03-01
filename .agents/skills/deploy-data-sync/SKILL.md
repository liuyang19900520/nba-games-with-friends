---
name: deploy-data-sync
description: |
  Trigger: User asks to "deploy sync worker", "update the data sync script on EC2", or "redeploy data sync".
  Do NOT trigger: For frontend Next.js Vercel deployments or Python AI Agent backend deployments.
---

# Deploy Data Sync Skill

## Overview
This skill instructs the agent on how to deploy the Node.js data-sync worker to the EC2 instance. The sync worker is responsible for fetching live NBA scores and updating the Supabase database.

## Pre-conditions
- Determine the correct branch to deploy (either `main` or `dev`).
- Ensure you have SSH access to the EC2 instance using the `terraform output ssh_command` if needed, OR just execute the GitHub Actions deployment directly via GitHub tools.

## Execution Steps
1. SSH into the EC2 instance.
2. Navigate to `/home/ubuntu/nba-games-with-friends`.
3. Fetch the latest code (`git fetch origin`).
4. Checkout the specified branch (`git checkout <branch>`) and pull latest (`git pull origin <branch>`).
5. Run `sudo docker compose build sync-worker`.
6. Run `sudo docker compose up -d sync-worker`.
7. Wait 5 seconds: `sleep 5`.

## Post-conditions (Verification)
- [ ] Check if the container is running: `sudo docker ps | grep nba-sync-worker`
- [ ] Check the logs for errors: `sudo docker logs --tail 20 nba-sync-worker`
- [ ] Ensure no "Exit 1" or fatal errors are present in the logs. If there are, immediately report them to the user.
