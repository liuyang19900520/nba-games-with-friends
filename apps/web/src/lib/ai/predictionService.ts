import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { generateJson } from './model';
import { seasonForDate, type PredictionOutput, type Progress } from './contracts';
import { AppError } from '@/lib/server/errors';
import type { AiMode } from '@/lib/server/config';

export async function runAIPrediction(
  db: SupabaseClient,
  input: { home_team: string; away_team: string; game_date: string; season?: string },
  mode: AiMode,
  signal: AbortSignal,
  progress: Progress,
): Promise<PredictionOutput> {
  progress({ step: 1, title: 'Checking the matchup', detail: input.game_date });
  const { data: teams, error } = await db.from('teams').select('id, name, code');
  if (error) throw new AppError('Team data is unavailable.', 'DATA_UNAVAILABLE', 503);
  // Match in memory against the small team list; no user text is interpolated into PostgREST filters.
  const find = (name: string) => teams?.find(t => t.name?.toLowerCase() === name.toLowerCase() || t.code?.toLowerCase() === name.toLowerCase());
  const home = find(input.home_team);
  const away = find(input.away_team);
  if (!home || !away || home.id === away.id) throw new AppError('Choose two known teams.', 'INVALID_TEAMS');
  const season = input.season || seasonForDate(input.game_date);
  progress({ step: 2, title: 'Reading previous results', detail: 'Only completed games before the selected date are used.' });
  const results = await Promise.all([home, away].map(team =>
    db.from('games_tokyo').select('id, home_team_id, away_team_id, home_score, away_score, game_date_tokyo')
      .or(`home_team_id.eq.${Number(team.id)},away_team_id.eq.${Number(team.id)}`)
      .eq('status', 'Final').eq('season', season).lt('game_date_tokyo', input.game_date)
      .order('game_date_tokyo', { ascending: false }).limit(5),
  ));
  if (results.some(r => r.error || !r.data?.length)) throw new AppError('Not enough previous game data for this matchup.', 'DATA_UNAVAILABLE');
  const evidence = [home, away].map((team, i) => {
    const games = results[i]!.data!;
    const completed = games.filter(g => g.home_score !== null && g.away_score !== null);
    if (!completed.length) throw new AppError('Scores are missing.', 'DATA_UNAVAILABLE');
    const wins = completed.filter(g => Number(g.home_team_id) === Number(team.id) ? g.home_score > g.away_score : g.away_score > g.home_score).length;
    return { team: team.name as string, wins, games: completed.length, results: completed };
  });
  const [homeEvidence, awayEvidence] = evidence;
  const dataAsOf = evidence.flatMap(e => e.results.map(g => String(g.game_date_tokyo))).sort().at(-1)!;
  if (mode === 'demo') {
    progress({ step: 3, title: 'Preparing the data demo', detail: 'No model or web-search API is called.' });
    const homeRate = homeEvidence!.wins / homeEvidence!.games;
    const awayRate = awayEvidence!.wins / awayEvidence!.games;
    return {
      winner: homeRate === awayRate ? 'No clear preference' : homeRate > awayRate ? home.name : away.name,
      confidence: null,
      key_factors: evidence.map(e => `${e.team}: ${e.wins} wins in ${e.games} previous games.`),
      detailed_analysis: 'Data demo: compares recent win rates only. Injuries and current news are not included. This is a transparent example, not a calibrated forecast.',
      mode, data_as_of: dataAsOf,
    };
  }
  progress({ step: 3, title: 'Generating the AI explanation', detail: 'One bounded model call using the stored game evidence.' });
  const schema = z.object({
    winner: z.enum([home.name as string, away.name as string, 'No clear preference']),
    key_factors: z.array(z.string().min(1).max(300)).min(1).max(4),
    detailed_analysis: z.string().min(1).max(1600),
  }).strict();
  const result = await generateJson(
    'Compare these NBA teams using only the supplied completed-game evidence. State missing information. Do not invent injuries, current news, odds or probabilities. JSON format: {"winner":"one of the supplied team names or No clear preference","key_factors":["evidence-based factor"],"detailed_analysis":"short explanation"}.',
    { matchup: input, evidence }, schema, signal,
  );
  return { ...result, confidence: null, mode, data_as_of: dataAsOf };
}
