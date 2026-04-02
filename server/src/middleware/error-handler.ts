import type { ErrorHandler } from 'hono';

const STATUS_CODE_MAP: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
};

export const errorHandler: ErrorHandler = (err, c) => {
  const status = 'status' in err && typeof err.status === 'number' ? err.status : 500;

  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err);

  const code = STATUS_CODE_MAP[status] ?? 'INTERNAL_ERROR';
  const message =
    status === 500 && process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;

  return c.json(
    {
      success: false as const,
      error: {
        code,
        message,
        ...(process.env.NODE_ENV !== 'production' && { details: { stack: err.stack } }),
      },
    },
    status as 500,
  );
};
