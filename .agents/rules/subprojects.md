# Subprojects Business Rules

This document outlines the business context, responsibilities, and operational procedures for the 5 internal subprojects comprising the **NBA Game with Friends** repository.

Any AI or agent interacting with this local source code MUST follow these established paradigms to ensure separation of concerns and avoid introducing structural regressions into the monorepo architecture.

## 1. Next.js Web App (`apps/web`)
*   **Role:** The frontend UI connecting end-users to the AI game functionalities.
*   **Core Stack:** React (Next.js App Router), Tailwind CSS, TypeScript.
*   **Rules:**
    *   State must be handled securely per defined conventions without leaking API limits to the client.
    *   Direct database queries (Supabase) happen exclusively on the server side (Server Actions).
*   **Deployments:** Vercel (Preview on `dev`, Production on `main`).

## 2. AI Agent Backend (`services/ai-agent`)
*   **Role:** Processing queries, orchestrating multi-agent evaluations, executing LangGraph routines to determine game results based on historical metrics.
*   **Core Stack:** LangGraph, FastAPI, Python, Pydantic.
*   **Rules:**
    *   Never mix data tool payloads with render tool payloads.
    *   Operates purely over REST API endpoints (primarily port `8000` / `8001`).
*   **Deployments:** Handled via Systemd services locally via EC2 triggers on `dev` & `main` branch pushes.

## 3. Data Sync Worker (`services/data-sync`)
*   **Role:** A continuous background process fetching real-time NBA data matrices and sinking them securely into Supabase to assure the database remains up to date.
*   **Core Stack:** Python Daemon.
*   **Rules:**
    *   Logs must be structured heavily to capture exit failures immediately.
    *   Should NOT expose external facing API ports, functions entirely inter-environmentally.
*   **Deployments:** Triggered via EC2 docker compose rebuilds.
*   **Manual Deployment Verification:** If manually deploying via EC2, ensure the Docker service (`nba-sync-worker`) is restarted and follow up by checking `sudo docker logs --tail 20 nba-sync-worker` to ensure no "Exit 1" conditions arose during boot.

## 4. Payment Lambda (`functions/payment`)
*   **Role:** Handling isolated high-security financial transactions, predominantly Stripe webhook ingress events granting account credits.
*   **Core Stack:** Node.js, AWS Lambda.
*   **Rules:**
    *   Maintains zero-trust, meaning secrets are heavily obfuscated.
    *   Serves entirely through a unified API Gateway layer.
*   **Deployments:** Handled by Terraform logic and pushed strictly through GitHub Action AWS Lambda CLI update steps.

## 5. n8n Workflow Automation
*   **Role:** High-level DevOps notification infrastructure tracking failed requests from specific subsystems and bouncing error notifications toward administrative Slack channels.
*   **Deployments:** Single-instance deployed on AWS Lightsail. No multiple branch deployments.
