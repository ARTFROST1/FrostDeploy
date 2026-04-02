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

const FRIENDLY_MESSAGES: Record<number, string> = {
  400: 'Неверный запрос. Проверьте введённые данные.',
  401: 'Сессия истекла. Войдите снова.',
  403: 'Недостаточно прав для этого действия.',
  404: 'Запрашиваемый ресурс не найден.',
  409: 'Конфликт данных. Обновите страницу и повторите.',
  429: 'Слишком много запросов. Подождите немного.',
  500: 'Внутренняя ошибка сервера. Попробуйте позже.',
};

export const errorHandler: ErrorHandler = (err, c) => {
  const status = 'status' in err && typeof err.status === 'number' ? err.status : 500;

  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err);

  const code = STATUS_CODE_MAP[status] ?? 'INTERNAL_ERROR';
  const message =
    process.env.NODE_ENV === 'production'
      ? (FRIENDLY_MESSAGES[status] ?? FRIENDLY_MESSAGES[500])
      : err.message;

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
