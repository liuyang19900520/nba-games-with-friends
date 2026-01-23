/**
 * Database-aligned types for DAL (Data Access Layer).
 *
 * 这些类型与 Supabase 中的表结构一一对应，用于 lib/db 层返回值。
 * UI 层可以继续使用 src/types/index.ts 中的视图模型类型。
 */

import type {
  Team as NbaTeam,
  TeamStanding as NbaTeamStanding,
  Player as NbaPlayer,
  PlayerSeasonStats as NbaPlayerSeasonStats,
  DatabaseTeamStanding,
  DatabasePlayerSeasonStats,
} from "@/types/nba";

/**
 * 直接复用与数据库表对齐的 NBA 类型作为 DAL 暴露类型
 */

// 团队（teams 表行，对 UI 友好的字符串 ID 版本）
export type DbTeam = NbaTeam;

// 球队战绩（team_standings 表 + joined team）
export type DbStanding = NbaTeamStanding;

// 球员基础信息（players 表的语义类型）
export type DbPlayer = NbaPlayer;

// 球员赛季统计（player_season_stats 表 + joined player/team）
export type DbPlayerSeasonStats = NbaPlayerSeasonStats;

// 原始数据库行类型（通常仅在 DAL 内部使用）
export type DbTeamStandingRow = DatabaseTeamStanding;
export type DbPlayerSeasonStatsRow = DatabasePlayerSeasonStats;
