# A&R Finder

A&R Finder is a full-stack student housing platform built with a Next.js frontend in `frontend/` and Convex + Better Auth backend/auth in `convex/`.

## Stack

- Next.js App Router + TypeScript
- Convex (database + server functions)
- Better Auth (`@convex-dev/better-auth`)
- Tailwind CSS + shadcn/ui components

## Prerequisites

- Node.js 20+
- npm 10+
- A configured Convex deployment

## Environment Setup

1. Copy `frontend/.env.example` to `frontend/.env.local` for the Next.js app.
2. Keep the root `.env.local` values aligned if you are also running Convex/backend code locally.
3. Fill in all required values.
4. Ensure production secrets are set in your deployment platform and Convex environment.

Required variables:

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL` (or set `CONVEX_SITE_URL` server-side)
- `NEXT_PUBLIC_APP_URL` (preferred; `NEXT_PUBLIC_SITE_URL` is accepted as fallback)
- `SITE_URL`
- `BETTER_AUTH_SECRET`
- `DEFAULT_ADMIN_PASSWORD` (only if using internal `admin.seedDefaultAdmin`)

## Local Development

```bash
npm install
npm run dev
```

App runs at `http://localhost:3000`.

The Next.js app source lives in `frontend/`. Repo-level npm scripts still run from the repository root.

## Quality Gates

```bash
npm run lint
npm run typecheck
npm run check
```

## Production Build

```bash
npm run build
```

If Turbopack is unstable in your environment:

```bash
npm run build:webpack
```

## Database Notes

- Canonical schema: `convex/schema.ts`
- Integrity tooling: `convex/dataIntegrity.ts`
- Data model documentation: `docs/database-design.md`

For deployment hygiene:

- seed only in non-production deployments
- review role-gated mutations before release
- periodically run integrity audit/repair workflows
- keep seed/admin bootstrap functions internal-only

## Deployment

- Set all environment variables in Vercel/hosting and Convex.
- Ensure `SITE_URL` and `NEXT_PUBLIC_APP_URL` match your production origin.
- Use a strong random `BETTER_AUTH_SECRET`.
