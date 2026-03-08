# A&R Finder

## Introduction

A&R Finder (Apartment and Roommate Finder) is a database-driven web application designed to help university students find off-campus housing and compatible roommates. The platform addresses a common challenge in student housing: relevant information is typically scattered across social media, group chats, and informal networks, making it difficult to compare options and identify suitable living arrangements. By centralizing housing listings and roommate profiles into a single system, A&R Finder gives students a more organized and reliable approach to the housing search process.

The application supports three primary user roles: students seeking housing, students seeking roommates, and apartment providers. Students can create profiles, browse apartment listings, and search for potential roommates based on their preferences. Apartment providers can post and manage listings, update availability, and view inquiries from interested students. Administrators oversee the platform and handle content moderation. This role-based structure ensures that each type of user has access to the features most relevant to their needs.

A central component of the system is the roommate matching functionality. Students complete profiles that capture lifestyle preferences such as sleep schedules, cleanliness habits, noise tolerance, budget range, and social tendencies. The system calculates compatibility scores between users based on these factors, helping students identify potential roommates who share similar living expectations. This reduces the guesswork involved in finding a compatible match and helps prevent conflicts that can arise from mismatched expectations.

The platform also supports collaborative housing searches through group functionality. Students can form groups with friends or matched roommates to coordinate their apartment search together. Within these groups, members can share listings, vote on options, and communicate through built-in messaging. This feature reflects how students typically approach housing searches in practice, working together rather than independently.

From a technical standpoint, A&R Finder was built as a full-stack web application using Next.js and React on the frontend, with Convex and TypeScript serving as the backend and database layer. The database schema follows relational design principles with normalized tables for users, profiles, listings, matches, groups, and related entities. The system implements role-based access control, server-side validation, and pagination to support efficient querying as the platform scales. Additional features include saved listings, reporting tools for moderation, and an admin dashboard for platform oversight.

## Demo Login Credentials

These seeded credentials are available for role-based testing:

- **Student**
  - Email: `group40@user.com`
  - Password: `User12345!`
- **Provider**
  - Email: `group40@provider.com`
  - Password: `Provider12345!`
- **Admin**
  - Email: `group40@admin.com`
  - Password: `Admin12345!`

> Important: sign-in is role-aware. Users must select the correct role (Student, Provider, or Admin) before signing in.

## Tech Stack

- Next.js (App Router) + React + TypeScript
- Convex (database + server functions)
- Better Auth (`@convex-dev/better-auth`)
- Tailwind CSS + shadcn/ui

## Repository Structure

- `frontend/`: Next.js app (UI, pages, client auth context, components)
- `convex/`: schema, queries, mutations, auth component integration, seed/integrity tooling
- `docs/database-design.md`: data model and integrity strategy documentation
- `tests/`: validation and normalization unit tests

## Prerequisites

- Node.js 20+
- npm 10+
- A configured Convex project/deployment

## Environment Configuration

There is no committed `.env.example` file in this repository. Configure environment variables directly in your local environment and deployment platforms.

### Required (runtime)

- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_SITE_URL` (or `NEXT_PUBLIC_CONVEX_SITE_URL`)
- `SITE_URL`
- `BETTER_AUTH_SECRET`

### Recommended

- `NEXT_PUBLIC_APP_URL` (preferred) or `NEXT_PUBLIC_SITE_URL` (fallback)

### Optional / feature-specific

- `OPENAI_API_KEY` (enables GPT-enhanced roommate matching insights)
- `DEFAULT_ADMIN_PASSWORD` (only for internal `admin.seedDefaultAdmin`)
- `CONVEX_DEPLOYMENT` (used for seed safety checks)

## Local Development

Install dependencies and run the app from the repository root:

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

## Quality Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run check
```

## Build

```bash
npm run build
```

If Turbopack is unstable in your environment:

```bash
npm run build:webpack
```

## Data Model and Operations Notes

- Canonical schema: `convex/schema.ts`
- Seed data + demo credential setup: `convex/seed.ts`
- Integrity auditing/repair: `convex/dataIntegrity.ts`
- Admin moderation/user tooling: `convex/admin.ts`

Use non-production deployments for seed/reset operations.
