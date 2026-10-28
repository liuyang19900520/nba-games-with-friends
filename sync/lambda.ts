// Scheduled sync Lambda (EventBridge Scheduler). Calls run() exported by sync/src/sync.ts.
// ESPN on-disk cache goes to /tmp (ephemeral per container) — set ESPN_CACHE_DIR=/tmp/espn-cache in the function env.
import { run } from "./src/sync.ts";
export const handler = async (event: { args?: string[] } = {}) => run(event.args ?? ["--games-only", "--days-back=1", "--ahead=1"]);
