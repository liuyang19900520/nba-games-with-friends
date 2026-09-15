import { handleAiRequest } from '@/lib/ai/request';
import { lineupInputSchema } from '@/lib/ai/contracts';
import { generateLineup } from '@/lib/ai/lineupService';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleAiRequest(request, { kind: 'lineup', schema: lineupInputSchema, run: generateLineup });
}
