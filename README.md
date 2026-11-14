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
│   ├── controllers/
│   │   └── tenant.controller.js  # Tenant registration & profile
│   ├── middlewares/
│   │   └── auth.middleware.js # API key authentication (x-api-key)
│   └── routes/
│       └── tenant.routes.js   # Tenant routes
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

## Authentication

Protected endpoints require the `x-api-key` header:

```http
x-api-key: sk_live_...
```

The middleware hashes the provided API key with SHA-256, queries the database for an active matching tenant, and attaches the tenant object to `req.tenant`. Inactive or missing keys return `401 Unauthorized`.

## API

### Health Check
```http
GET /health
```
**Response (200 OK):**
```json
{ "status": "ok", "message": "Platform API is alive!" }
```

### Register Tenant
```http
POST /api/v1/tenants/register
Content-Type: application/json

{ "name": "Acme Corp" }
```
**Response (201 Created):**
```json
{
  "id": "c1f71df8-3d12-4c28-98e3-0c46dfc8e11b",
  "name": "Acme Corp",
  "status": "active",
  "apiKey": "sk_live_...",
  "message": "Save this API key securely. You will not be able to view it again."
}
```

### Get Current Tenant Profile (Protected)
```http
GET /api/v1/tenants/me
x-api-key: sk_live_...
```
**Response (200 OK):**
```json
{
  "id": "c1f71df8-3d12-4c28-98e3-0c46dfc8e11b",
  "name": "Acme Corp",
  "status": "active",
  "plan_id": null,
  "created_at": "2026-11-13T17:15:29.000Z"
}
```

**Error Responses:**
- `401 Unauthorized`: Missing `x-api-key` header or invalid/inactive key
- `500 Internal Server Error`: Server failure

## License

ISC

