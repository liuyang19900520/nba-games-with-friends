import { z } from 'zod';

export const gameDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  value => { const date = new Date(value + 'T00:00:00Z'); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; },
  'Invalid calendar date',
);
const seasonSchema = z.string().regex(/^\d{4}-\d{2}$/).optional();
export const predictInputSchema = z.object({
  home_team: z.string().trim().min(1).max(80),
  away_team: z.string().trim().min(1).max(80),
  game_date: gameDateSchema,
  season: seasonSchema,
}).strict().refine(value => value.home_team !== value.away_team, 'Choose two different teams');
export const lineupInputSchema = z.object({ game_date: gameDateSchema, season: seasonSchema }).strict();

export function seasonForDate(date: string) {
  const year = Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 10 ? 1 : 0);
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}
export interface PredictionOutput {
  winner: string;
  confidence: number | null;
  key_factors: string[];
  detailed_analysis: string;
  mode: 'demo' | 'llm';
  data_as_of: string;
}
export interface LineupPlayer {
  player_id: string;
  player_name: string;
  position: string;
  headshot_url: string;
  team_name: string;
  team_code: string;
  team_logo_url: string;
  pts: number;
  reb: number;
  ast: number;
  fantasy_avg: number;
}
export interface ProgressStep {
  step: number;
  phase?: string;
  title: string;
  detail: string;
}
export type Progress = (step: ProgressStep) => void;
