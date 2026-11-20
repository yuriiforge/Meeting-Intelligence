import { Body, Controller, Logger, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ChatService } from './chat.service.js';
import type { ChatEvent } from './chat.types.js';

const chatRequestSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      }),
    )
    .max(20)
    .default([]),
  meetingIds: z.array(z.uuid()).max(50).optional(),
});

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chat: ChatService) {}

  /**
   * Answers a question as a stream of server-sent events (see ChatEvent).
   * POST rather than GET because the conversation history is in the body.
   */
  @Post()
  async ask(
    @Body({ schema: chatRequestSchema })
    body: z.infer<typeof chatRequestSchema>,
    @Res() res: Response,
  ): Promise<void> {
    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx: don't buffer the stream
    });
    res.flushHeaders();

    // Stop generating (and paying for tokens) when the user goes away.
    const abort = new AbortController();
    res.on('close', () => abort.abort());

    const send = (event: ChatEvent) =>
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);

    try {
      for await (const event of this.chat.answer(body, abort.signal)) {
        if (abort.signal.aborted) break;
        send(event);
      }
    } catch (error) {
      if (!abort.signal.aborted) {
        this.logger.error(
          `chat failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        send({
          type: 'error',
          message:
            'The assistant could not answer right now. Please try again.',
        });
      }
    } finally {
      res.end();
    }
  }
}
