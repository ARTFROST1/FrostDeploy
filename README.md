<p align="center">
  <img src="Globe," width="80" alt="FrostDeploy logo" />
</p>

<h1 align="center">FrostDeploy</h1>

<p align="center">
  <strong>Mini-Vercel on your own VDS.</strong><br/>
  One self-hosted service replaces all your hand-rolled admin panels and manual SSH deploys.<br/>
  Auto-detect framework · deploy on commit · instant rollback · real-time logs · built-in analytics<br/>
  <em>No Docker required — Node.js + SQLite + Caddy.</em>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#development">Development</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#supported-frameworks">Frameworks</a> ·
  <a href="#roadmap">Roadmap</a> ·
  <a href="#contributing">Contributing</a>
</p>

---

<!-- TODO: screenshot of the dashboard -->

## Quick Start

Deploy FrostDeploy on a clean VDS in four commands:

```bash
# Requirements: Ubuntu 22.04+ or Debian 12+, Node.js 20+

# 1. Install
curl -fsSL https://raw.githubusercontent.com/artfrost/frostdeploy/main/scripts/install.sh | bash

# 2. Open the dashboard
open https://your-domain:9000

# 3. Complete the setup wizard — create admin account, connect your first repo
```

## Development

```bash
git clone https://github.com/artfrost/frostdeploy.git
cd frostdeploy
pnpm install
cp .env.example .env  # Configure environment variables
pnpm db:migrate       # Run database migrations
pnpm dev              # Start dev server
```

The project is a **pnpm workspace monorepo** with the following packages:

| Package | Description |
|---------|-------------|
| `server/` | Hono API + build engine + queue |
| `ui/` | React SPA (dashboard) |
| `packages/db/` | Drizzle ORM schema & migrations |
| `packages/shared/` | Shared types and utilities |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          VDS Server                             │
│                                                                 │
│  ┌──────────────────────────┐    ┌───────────────────────────┐  │
│  │   FrostDeploy :9000      │    │         Caddy 2.9         │  │
│  │   (Node.js 22 + SQLite)  ├───►│   domain → 127.0.0.1:X   │  │
│  │                          │    │   auto-SSL (ACME)         │  │
│  │  ┌────────┐  ┌────────┐ │    └──────────┬────────────────┘  │
│  │  │React   │  │Hono API│ │               │                    │
│  │  │SPA     │  │        │ │    ┌──────────▼────────────────┐  │
│  │  └────────┘  └───┬────┘ │    │    Managed Projects       │  │
│  │              ┌────▼────┐ │    │  ┌──────────┐             │  │
│  │              │ Build   │ │    │  │ App A    │ :4321       │  │
│  │              │ Engine  │─┼───►│  │ (systemd)│             │  │
│  │              │ + Queue │ │    │  ├──────────┤             │  │
│  │              └────┬────┘ │    │  │ App B    │ :4322       │  │
│  │              ┌────▼────┐ │    │  │ (systemd)│             │  │
│  │              │ SQLite  │ │    │  └──────────┘             │  │
│  │              │ (WAL)   │ │    └───────────────────────────┘  │
│  │              └─────────┘ │                                    │
│  └──────────────────────────┘                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Tech stack:** Node.js 22 · Hono 4 · SQLite (WAL) + Drizzle ORM · React 19 · TailwindCSS 4 · shadcn/ui · Caddy 2.9 · systemd · pnpm workspaces · Vitest · ESLint 9

## Supported Frameworks

| Category | Support | Strategy |
|----------|---------|----------|
| **Node.js** (Astro, Next.js, Nuxt, SvelteKit, Remix, Express, Fastify, Koa, NestJS) | ✅ | Native: `npm ci` → `build` → `rsync` |
| **Static sites** (Vite, Eleventy, Hugo, Jekyll) | ✅ | `npm run build` → Caddy file server |
| Any npm project with `scripts.start` | ✅ | Fallback: `npm ci` → `npm start` |
| Python, Go, Rust, PHP, Docker | ❌ MVP | Planned v0.2–v0.4 via Nixpacks |

## Roadmap

| Version | Highlights |
|---------|------------|
| **v0.1** (MVP) | Node.js + Static, Dashboard, Deploy engine, Proxy manager, Auth, Monitoring |
| **v0.2** | Webhooks, Analytics, CLI, Telegram notifications, Zero-downtime deploys, Python (Nixpacks) |
| **v0.3** | Go, Docker, Preview Deployments, Monorepo support |
| **v0.4** | Rust, PHP (FrankenPHP), 2FA, Audit log |
| **v0.5** | Multi-server (SSH) |
| **v1.0** | Multi-user, API keys, IaC, Marketplace, Plugins |

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## License

[MIT](LICENSE)
