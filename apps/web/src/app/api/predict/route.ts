import { handleAiRequest } from '@/lib/ai/request';
import { predictInputSchema } from '@/lib/ai/contracts';
import { runAIPrediction } from '@/lib/ai/predictionService';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleAiRequest(request, {
    kind: 'prediction', schema: predictInputSchema,
    run: async (db, input, mode, signal, progress) => ({
      prediction: await runAIPrediction(db, input, mode, signal, progress),
    }),
  });
}
