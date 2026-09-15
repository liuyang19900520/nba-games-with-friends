import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { safeLocalRedirect } from '@/lib/auth/redirect';
import { generateJson } from '@/lib/ai/model';
import { runAIPrediction } from '@/lib/ai/predictionService';
import { generateLineup } from '@/lib/ai/lineupService';

function fixtureDb(responses: unknown[]) {
  const queries: { table: string; calls: [string, ...unknown[]][] }[] = [];
  const from = vi.fn((table: string) => {
    const response = responses.shift();
    const query = { table, calls: [] as [string, ...unknown[]][] };
    queries.push(query);
    const builder: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve),
    };
    for (const name of ['select', 'eq', 'lt', 'or', 'in', 'not', 'order', 'limit']) {
      builder[name] = (...args: unknown[]) => { query.calls.push([name, ...args]); return builder; };
    }
    return builder;
  });
  return { db: { from } as unknown as SupabaseClient, queries };
}

beforeEach(() => { vi.stubEnv('DEEPSEEK_API_KEY', 'unit-test-only'); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('local authentication destinations', () => {
  it('allows internal paths and rejects protocol-relative, external or normalized external destinations', () => {
    expect(safeLocalRedirect('/home?date=2026-09-13')).toBe('/home?date=2026-09-13');
    for (const path of ['https://evil.test', '//evil.test', '/\\evil.test', '/\nevil.test', 'javascript:alert(1)']) {
      expect(safeLocalRedirect(path)).toBe('/lineup');
    }
  });
});

describe('bounded model adapter', () => {
  it('makes one non-thinking, token-bounded request and validates the JSON result', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ choices: [{ message: { content: '{"answer":"ok"}' } }] }));
    expect(await generateJson('Explain', { fact: 1 }, z.object({ answer: z.string() }).strict(), new AbortController().signal)).toEqual({ answer: 'ok' });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, options] = vi.mocked(fetch).mock.calls[0]!;
    expect(JSON.parse(options!.body as string)).toMatchObject({ thinking: { type: 'disabled' }, max_tokens: 700, response_format: { type: 'json_object' } });
  });
  it('rejects malformed model output without retrying or returning a fake answer', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ choices: [{ message: { content: '{"wrong":1}' } }] }));
    await expect(generateJson('Explain', {}, z.object({ answer: z.string() }), new AbortController().signal)).rejects.toMatchObject({ code: 'INVALID_AI_RESULT' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('evidence-based demo services', () => {
  it('uses correct score fields, excludes selected-date games, and never calls a model in demo', async () => {
    const { db, queries } = fixtureDb([
      { data: [{ id: 1, name: 'Home', code: 'HOM' }, { id: 2, name: 'Away', code: 'AWY' }], error: null },
      { data: [{ id: 10, home_team_id: 1, away_team_id: 3, home_score: 100, away_score: 90, game_date_tokyo: '2026-04-10' }], error: null },
      { data: [{ id: 11, home_team_id: 3, away_team_id: 2, home_score: 105, away_score: 90, game_date_tokyo: '2026-04-11' }], error: null },
    ]);
    const result = await runAIPrediction(db, { home_team: 'HOM', away_team: 'AWY', game_date: '2026-04-12' }, 'demo', new AbortController().signal, vi.fn());
    expect(result).toMatchObject({ winner: 'Home', mode: 'demo', confidence: null, data_as_of: '2026-04-11' });
    for (const query of queries.slice(1)) {
      expect(query.calls).toContainEqual(['lt', 'game_date_tokyo', '2026-04-12']);
      expect(query.calls).toContainEqual(['eq', 'season', '2025-26']);
      expect(query.calls).toContainEqual(['eq', 'status', 'Final']);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it('returns no invented evidence when game data is absent', async () => {
    const { db } = fixtureDb([
      { data: [{ id: 1, name: 'Home' }, { id: 2, name: 'Away' }] },
      { data: [] }, { data: [] },
    ]);
    await expect(runAIPrediction(db, { home_team: 'Home', away_team: 'Away', game_date: '2026-04-12' }, 'demo', new AbortController().signal, vi.fn())).rejects.toMatchObject({ code: 'DATA_UNAVAILABLE' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('selects exactly five unique players and scopes statistics to teams on the selected date', async () => {
    const rows = [1, 1, 2, 3, 4, 5, 6].map(id => ({
      player_id: id, pts: 20, reb: 5, ast: 3, fantasy_avg: 60 - id,
      player: { id, full_name: 'Player ' + id, position: 'G', team: { name: 'Home', code: 'HOM' } },
    }));
    const { db, queries } = fixtureDb([
      { data: [{ home_team_id: 10, away_team_id: 20 }] }, { data: rows },
    ]);
    const result = await generateLineup(db, { game_date: '2026-04-12' }, 'demo', new AbortController().signal, vi.fn());
    expect(result.players.map(p => p.player_id)).toEqual(['1', '2', '3', '4', '5']);
    expect(queries[1]!.calls).toContainEqual(['in', 'team_id', [10, 20]]);
    expect(queries[1]!.calls).toContainEqual(['in', 'player.team_id', [10, 20]]);
    expect(result.explanation).toContain('Injury status');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not return or charge a successful-looking incomplete lineup', async () => {
    const { db } = fixtureDb([{ data: [{ home_team_id: 10, away_team_id: 20 }] }, { data: [] }]);
    await expect(generateLineup(db, { game_date: '2026-04-12' }, 'demo', new AbortController().signal, vi.fn())).rejects.toMatchObject({ code: 'DATA_UNAVAILABLE' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
