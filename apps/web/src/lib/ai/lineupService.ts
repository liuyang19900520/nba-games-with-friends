import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { seasonForDate, type LineupPlayer, type Progress } from './contracts';
import { generateJson } from './model';
import type { AiMode } from '@/lib/server/config';
import { AppError } from '@/lib/server/errors';

export async function generateLineup(db: SupabaseClient, input: { game_date: string; season?: string }, mode: AiMode, signal: AbortSignal, progress: Progress) {
  const season = input.season || seasonForDate(input.game_date);
  progress({ step: 1, title: 'Checking the schedule', detail: input.game_date });
  const { data: games, error: gameError } = await db.from('games_tokyo')
    .select('home_team_id, away_team_id').eq('game_date_tokyo', input.game_date).eq('season', season);
  if (gameError || !games?.length) throw new AppError('No games available for this date.', 'DATA_UNAVAILABLE');
  const teamIds = [...new Set(games.flatMap(g => [Number(g.home_team_id), Number(g.away_team_id)]))];
  progress({ step: 2, title: 'Ranking eligible players', detail: 'Season fantasy averages; five different players with games on this date.' });
  const { data, error } = await db.from('player_season_stats')
    .select('player_id, pts, reb, ast, fantasy_avg, player:players!inner(id, full_name, position, headshot_url, team_id, team:teams(name, code, logo_url))')
    .eq('season', season).in('team_id', teamIds).in('player.team_id', teamIds)
    .not('fantasy_avg', 'is', null).order('fantasy_avg', { ascending: false }).limit(30);
  if (error) throw new AppError('Player statistics are unavailable.', 'DATA_UNAVAILABLE');
  const players: LineupPlayer[] = [];
  for (const row of data || []) {
    // PostgREST's untyped client infers relations as arrays; these foreign keys are to-one.
    const player = row.player as unknown as { id: number; full_name: string; position: string; headshot_url: string; team: { name: string; code: string; logo_url: string } };
    if (!player || players.some(p => p.player_id === String(player.id))) continue;
    players.push({
      player_id: String(player.id), player_name: player.full_name, position: player.position || '',
      headshot_url: player.headshot_url || '', team_name: player.team?.name || '',
      team_code: player.team?.code || '', team_logo_url: player.team?.logo_url || '',
      pts: Number(row.pts || 0), reb: Number(row.reb || 0), ast: Number(row.ast || 0), fantasy_avg: Number(row.fantasy_avg),
    });
    if (players.length === 5) break;
  }
  if (players.length !== 5 || players.some(p => !Number.isFinite(p.fantasy_avg))) throw new AppError('Five eligible players are not available.', 'DATA_UNAVAILABLE');
  let explanation = 'Data demo: the five highest season fantasy averages among eligible teams. Injury status and playing-time changes are not included.';
  if (mode === 'llm') {
    progress({ step: 3, title: 'Explaining the five-player selection', detail: 'The model explains the ranking; it does not change your lineup or submit it.' });
    const schema = z.object({ explanation: z.string().min(1).max(1800) }).strict();
    const output = await generateJson('Explain these five selected NBA players using only their supplied statistics. Disclose missing injuries and playing-time data. Do not suggest different players or invent stats. Return JSON: {"explanation":"concise explanation"}.',
      { date: input.game_date, season, players }, schema, signal);
    explanation = output.explanation;
  } else {
    progress({ step: 3, title: 'Preparing the data demo', detail: 'No paid model call.' });
  }
  return { game_date: input.game_date, players, mode, explanation, season };
}
