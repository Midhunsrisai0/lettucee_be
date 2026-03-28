# lettucee_be (Cloudflare Worker + Hono)

Basic backend starter following a modular structure:

- `src/app.ts`: app setup and middleware
- `src/index.ts`: Worker entrypoint
- `src/routes/index.ts`: route registration
- `src/db/schema.ts`: centralized Drizzle schema + inferred types
- `src/modules/*`: domain modules (`routes`, `controller`, `repository`, `schema`)
- `migrations/*.sql`: D1 schema migrations

## 1) Install

```bash
npm install
```

## 2) Configure D1

1. Create DB:

```bash
npx wrangler d1 create lettucee-db
```

2. Replace `database_id` in [wrangler.jsonc](wrangler.jsonc).

3. Run initial migration:

```bash
npx wrangler d1 execute lettucee-db --file=./migrations/0001_init.sql
```

## 3) Run locally

```bash
npm run dev
```

## Migration workflow (every schema change)

1. Update Drizzle schema in `src/db/schema.ts`.
2. Generate SQL migration from schema changes:

```bash
npm run db:generate
```

3. Apply to local D1:

```bash
npm run db:migrate:local
```

4. After verifying locally, apply to remote D1:

```bash
npm run db:migrate:remote
```

## Local D1: view data and run manual SQL

`--local` means DB on your laptop (Wrangler-managed SQLite).
`--remote` means DB hosted in Cloudflare.

Useful scripts:

```bash
# list local tables
npm run db:tables:local

# list users in local DB
npm run db:users:local

# run any local SQL
npm run db:query:local -- "SELECT * FROM users LIMIT 20;"

# run any remote SQL
npm run db:query:remote -- "SELECT * FROM users LIMIT 20;"
```

## 4) Deploy

```bash
npm run deploy
```

## Initial API

- `GET /health`
- `POST /api/v1/users/register`
- `GET /api/v1/users`
