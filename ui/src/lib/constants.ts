export const POLLING_INTERVALS = {
  systemMetrics: 10_000,
  projects: 30_000,
  deployStream: 1_000,
  logs: 5_000,
} as const;

export const STATUS_COLORS = {
  active: 'bg-emerald-500',
  success: 'bg-emerald-500',
  deploying: 'bg-blue-500',
  building: 'bg-blue-500',
  queued: 'bg-blue-500',
  error: 'bg-red-500',
  failed: 'bg-red-500',
  warning: 'bg-amber-500',
  created: 'bg-zinc-500',
  stopped: 'bg-zinc-500',
  idle: 'bg-zinc-500',
} as const;

export const STATUS_TEXT_COLORS = {
  active: 'text-emerald-500',
  success: 'text-emerald-500',
  deploying: 'text-blue-500',
  building: 'text-blue-500',
  queued: 'text-blue-500',
  error: 'text-red-500',
  failed: 'text-red-500',
  warning: 'text-amber-500',
  created: 'text-zinc-500',
  stopped: 'text-zinc-500',
} as const;

export const FRAMEWORK_ICONS: Record<string, string> = {
  nextjs: 'Globe',
  nuxt: 'Globe',
  astro: 'Rocket',
  'astro-ssr': 'Rocket',
  'astro-static': 'Rocket',
  remix: 'Disc',
  vite: 'Zap',
  cra: 'Atom',
  express: 'Server',
  fastify: 'Bolt',
  hono: 'Flame',
  nestjs: 'Box',
  sveltekit: 'Globe',
  koa: 'Server',
  static: 'FileText',
  unknown: 'HelpCircle',
};
