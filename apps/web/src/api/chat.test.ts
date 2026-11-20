import { SseParser } from './chat';

const event = (type: string, data: object) =>
  `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;

describe('SseParser', () => {
  it('parses complete events', () => {
    const parser = new SseParser();

    const events = parser.push(
      event('token', { text: 'Hel' }) + event('token', { text: 'lo' }),
    );

    expect(events).toEqual([
      { type: 'token', text: 'Hel' },
      { type: 'token', text: 'lo' },
    ]);
  });

  it('waits for the rest of an event split across chunks', () => {
    const parser = new SseParser();
    const raw = event('token', { text: 'split' });

    expect(parser.push(raw.slice(0, 15))).toEqual([]);
    expect(parser.push(raw.slice(15))).toEqual([
      { type: 'token', text: 'split' },
    ]);
  });

  it('handles CRLF line endings', () => {
    const parser = new SseParser();

    expect(
      parser.push('event: token\r\ndata: {"type":"token","text":"x"}\r\n\r\n'),
    ).toEqual([{ type: 'token', text: 'x' }]);
  });

  it('ignores blocks without data, such as comments', () => {
    const parser = new SseParser();

    expect(parser.push(': keep-alive\n\n')).toEqual([]);
  });
});
