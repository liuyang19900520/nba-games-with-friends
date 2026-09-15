import { describe, expect, it } from 'vitest';
import { readEventStream } from '@/lib/http/sse';
function response(text: string, chunkSize = 1) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(c) {
    for (let i = 0; i < bytes.length; i += chunkSize) c.enqueue(bytes.slice(i, i + chunkSize));
    c.close();
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
}
describe('SSE transport', () => {
  it('preserves split event names, CRLF and multibyte text', async () => {
    const events: string[] = [];
    await readEventStream(response('event: progress\r\ndata: {"title":"准备🏀"}\r\n\r\nevent: result\r\ndata: {"ok":true}\r\n\r\nevent: done\r\ndata: {}\r\n\r\n'), event => events.push(event.event + ':' + (event.data.title || '')));
    expect(events).toEqual(['progress:准备🏀', 'result:', 'done:']);
  });
  it('rejects an interrupted stream rather than showing success', async () => {
    await expect(readEventStream(response('event: progress\ndata: {"step":1}\n\n'), () => {})).rejects.toThrow('interrupted');
  });
  it('does not accept done without a result', async () => {
    await expect(readEventStream(response('event: done\ndata: {}\n\n'), () => {})).rejects.toThrow('without a result');
  });
  it('surfaces malformed JSON and server errors', async () => {
    await expect(readEventStream(response('event: result\ndata: invalid\n\n'), () => {})).rejects.toThrow('Malformed');
    await expect(readEventStream(response('event: error\ndata: {"message":"Refunded"}\n\n'), () => {})).rejects.toThrow('Refunded');
  });
});
