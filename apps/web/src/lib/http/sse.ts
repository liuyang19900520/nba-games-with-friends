export interface StreamEvent { event: string; data: Record<string, unknown> }
export class StreamError extends Error {
  constructor(message: string, public code?: string) { super(message); }
}

/** Retain event names, UTF-8 decoder state and partial frames across network chunks. */
export async function readEventStream(response: Response, onEvent: (event: StreamEvent) => void) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new StreamError(data.error || 'Unable to start the request.', data.code);
  }
  const reader = response.body?.getReader();
  if (!reader || !response.headers.get('content-type')?.includes('text/event-stream')) throw new StreamError('Invalid response stream.');
  const decoder = new TextDecoder();
  let buffer = '';
  let complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      // Normalise complete CRLF pairs only; a trailing CR may belong to the next chunk.
      buffer = buffer.replace(/\r\n/g, '\n');
      if (buffer.length > 131072) throw new StreamError('Response is too large.');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const lines = frame.split('\n');
        const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim() || 'message';
        const payload = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!payload) continue;
        let data: Record<string, unknown>;
        try {
          const parsed = JSON.parse(payload);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
          data = parsed;
        } catch { throw new StreamError('Malformed response event.'); }
        if (event === 'error') throw new StreamError(String(data.message || 'Generation failed.'), String(data.code || 'GENERATION_FAILED'));
        if (event === 'result') complete = true;
        if (event === 'done' && !complete) throw new StreamError('The request ended without a result.', 'STREAM_INTERRUPTED');
        onEvent({ event, data });
      }
      if (done) break;
    }
    if (!complete) throw new StreamError('Connection interrupted before a result arrived.', 'STREAM_INTERRUPTED');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
