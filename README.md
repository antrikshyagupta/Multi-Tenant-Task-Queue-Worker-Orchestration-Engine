# Multi-Tenant Task Queue & Worker Orchestration Engine

A SaaS backend platform that provides multi-tenant job queuing, scheduling, and worker orchestration — built with Node.js, Express, PostgreSQL, BullMQ, and Redis.

## Architecture

```
Client (API Key) → Express API → PostgreSQL (Jobs/Tenants) → BullMQ (Redis) → Workers
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (CommonJS) |
| Framework | Express 5 |
| Database | PostgreSQL |
| ORM | Prisma |
| Queue | BullMQ |
| Cache/Broker | Redis |
| Auth | API Key (SHA-256 hashed) |

## Data Models

- **Tenant** — registered org with hashed API key, plan, status
- **Job** — tenant-scoped task with type, JSON payload, priority, scheduling, idempotency key
- **Execution** — per-attempt record with worker ID, duration, error tracking

## Project Structure

```
├── server.js                  # Entry point
├── src/
│   ├── app.js                 # Express app setup
│   ├── config/
│   │   └── prisma.js          # Prisma client singleton
│   └── controllers/
│       └── tenant.controller.js  # Tenant registration
├── prisma/
│   ├── schema.prisma          # DB schema
│   └── migrations/            # Migration history
├── package.json
└── .env                       # (not committed)
```

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and PORT

# 3. Run migrations
npx prisma migrate dev

# 4. Start server
node server.js
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/saas_db?schema=public` |
| `PORT` | Server port | `3000` |

## API

### Health Check
```
GET /health
→ { "status": "ok", "message": "Platform API is alive!" }
```

### Register Tenant
```
POST /api/v1/tenants/register
Body: { "name": "Acme Corp" }
→ { "id": "...", "name": "Acme Corp", "status": "active", "apiKey": "sk_live_...", "message": "Save this API key securely..." }
```

## License

ISC
