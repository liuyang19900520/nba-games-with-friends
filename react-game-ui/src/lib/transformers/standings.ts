import type { DbStanding } from "@/types/db";
import type { LeaderboardEntry } from "@/types";

/**
 * 将 DAL 层的 DbStanding（接近数据库结构）
 * 转换为 UI 层 LeaderboardEntry（排行榜组件使用的视图模型）。
 */
export function transformDbStandingToEntry(
  standing: DbStanding
): LeaderboardEntry {
  const { team_id, wins, losses, win_pct, conf_rank, streak, team } = standing;

  // 胜率原始值为 0.x，UI 希望看到小数形式（保留三位小数）
  const winPct = typeof win_pct === "number" ? Number(win_pct.toFixed(3)) : 0;

  return {
    id: team_id, // 使用 team_id 作为排行榜条目的 id
    rank: conf_rank,
    name: team.nickname || team.name,
    value: wins, // 默认 value 展示为胜场数
    logoUrl: team.logo_url ?? undefined,
    conference: team.conference,
    wins,
    losses,
    winPct,
    streak: streak ?? undefined,
    // 额外信息可以通过扩展 LeaderboardEntry 或在组件中通过 id 再查
  };
}
