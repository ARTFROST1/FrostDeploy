import { streamSSE } from 'hono/streaming';
import type { Context } from 'hono';
import type { DeployStep, StepStatus } from '@fd/shared';

export type SSEEvent =
  | { type: 'step'; step: DeployStep; status: StepStatus; message: string; timestamp: string }
  | { type: 'log'; message: string; timestamp: string }
  | { type: 'status'; status: string; message: string; timestamp: string }
  | { type: 'complete'; message: string; timestamp: string }
  | { type: 'error'; error: string; timestamp: string };

export function formatSSEEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export type DeployStreamCallback = (send: (event: SSEEvent) => Promise<void>) => Promise<void>;

export function createDeployStream(c: Context, callback: DeployStreamCallback) {
  return streamSSE(c, async (stream) => {
    const send = async (event: SSEEvent) => {
      await stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
      });
    };
    await callback(send);
  });
}

export function sendSSEEvent(
  stream: { writeSSE: (data: { event: string; data: string }) => Promise<void> },
  event: SSEEvent,
): Promise<void> {
  return stream.writeSSE({
    event: event.type,
    data: JSON.stringify(event),
  });
}
