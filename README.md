# Multi-Tenant Task Queue & Worker Orchestration Engine

A robust, multi-tenant SaaS backend platform for background job queuing, delayed task scheduling, idempotency control, tenant quotas, API key management, and worker orchestration. Built with Node.js, Express 5, PostgreSQL, Prisma ORM, BullMQ, and Redis.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────┐
                      │            Client Application            │
                      └────────────────────┬─────────────────────┘
                                           │ HTTP Request (x-api-key)
                                           ▼
                      ┌──────────────────────────────────────────┐
                      │          Express API Server              │
                      │  - Auth Middleware (Multi-Key Rotation) │
                      │  - Rate Limiter (Redis Fixed Window)     │
                      │  - Quota Guard (Payload Size & Queued)   │
                      │  - Idempotency & Tenant Scoping          │
                      └─────────────┬──────────────────┬─────────┘
                                    │                  │
                1. Persist Job (Durable)       2. Enqueue Job
                                    ▼                  ▼
                      ┌──────────────────┐    ┌──────────────────┐
                      │ PostgreSQL DB    │    │ Redis (BullMQ)   │
                      │ - Tenants & Plans│    │ - Task Queues    │
                      │ - API Keys       │    │ - Delayed Jobs   │
                      │ - Jobs           │    │ - Priority Queue │
                      │ - Executions     │    │ - Rate Limiting  │
                      └──────────────────┘    └────────┬─────────┘
                                                       │
                                          3. Pull Jobs (Concurrency: 5)
                                                       ▼
                                      ┌──────────────────────────────────┐
                                      │   Worker Process (worker.js)     │
                                      │   - Worker ID Tracking           │
                                      │   - Attempt & Duration Logging   │
                                      │   - 30s Execution Timeout Guard  │
                                      │   - Automatic Exponential Retry  │
                                      │   - Handlers (Report, Email,...) │
                                      └──────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Runtime** | Node.js | CommonJS modules |
| **Framework** | Express 5 | REST API framework with centralized JSON error handling |
| **Database** | PostgreSQL | Relational storage for tenants, subscription plans, API keys, jobs, and execution history |
| **ORM** | Prisma | Schema definitions, type safety, relational migrations, and database seeding |
| **Queue & Broker** | BullMQ & Redis | Redis-backed distributed task queue with priority, delays, and worker concurrency |
| **Rate Limiter & Cache** | Redis (ioredis) | Per-tenant fixed-window rate limiting counters |
| **Authentication** | Multi-Key Auth | SHA-256 hashed API keys with prefix masking, rotation, and revocation |
| **Infrastructure** | Docker Compose | Local containerized PostgreSQL 16 and Redis services |

---

## Subscription Plans & Tenant Quotas

Each tenant is assigned a subscription plan (`free`, `pro`, or `enterprise`) that governs rate limits, payload sizes, and concurrency:

| Metric | Free | Pro | Enterprise |
|---|---|---|---|
| **Rate Limit** | 30 requests / min | 120 requests / min | 600 requests / min |
| **Max Queued Jobs** | 20 jobs | 500 jobs | 10,000 jobs |
| **Max Payload Size** | 32 KB | 256 KB | 1 MB |
| **Max Concurrent Jobs** | 2 | 10 | 50 |
| **Scheduling Weight** | 1 | 3 | 10 |

---

## Data Models

The Prisma schema defines the following core models:

- **`Plan`**: Defines subscription tiers (`free`, `pro`, `enterprise`) and resource quotas (rate limits, queue capacity, payload size, concurrency, and weight).
- **`Tenant`**: Organizations registered on the platform, linked to a subscription plan and active status.
- **`ApiKey`**: Multiple API keys per tenant supporting rotation and revocation. Stores `key_prefix` (e.g. `sk_live_a1b2c3`) for safe display, `key_hash` (SHA-256), `is_active`, `revoked_at`, and `last_used_at` audit timestamps.
- **`Job`**: Tenant-scoped tasks with job `type`, JSON `payload`, `priority`, `scheduled_at`, `idempotency_key`, and `status` (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`).
- **`Execution`**: Historical audit log of every execution attempt. Tracks `worker_id`, `attempt_number`, `status` (`RUNNING`, `COMPLETED`, `FAILED`), duration in milliseconds (`execution_duration`), error messages, and start/finish timestamps.

---

## Project Structure

```
├── docker-compose.yml           # PostgreSQL and Redis services
├── package.json                 # Dependencies and npm scripts
├── server.js                    # API server entry point
├── worker.js                    # Background worker process entry point (concurrency & timeout guards)
├── prisma/
│   ├── schema.prisma            # Database schema & relations (Plan, Tenant, ApiKey, Job, Execution)
│   ├── seed.js                  # Database seed script for default plans (free, pro, enterprise)
│   └── migrations/              # Prisma migration history
├── src/
│   ├── app.js                   # Express application, route mounting & centralized error handling
│   ├── config/
│   │   ├── prisma.js            # Prisma client singleton
│   │   └── redis.js             # IORedis connection configuration
│   ├── controllers/
│   │   ├── job.controller.js    # Job creation, pagination, inspection & cancellation
│   │   └── tenant.controller.js # Tenant registration, plan upgrade & API key rotation/revocation
│   ├── middlewares/
│   │   ├── auth.middleware.js   # Multi-key authentication, revocation checks & last_used_at updates
│   │   └── quota.middleware.js  # Redis rate limiter & job quota enforcement (payload size & queued limit)
│   ├── queues/
│   │   └── job.queue.js         # BullMQ queue configuration & exponential backoff policies
│   ├── routes/
│   │   ├── job.routes.js        # Job API routes
│   │   └── tenant.routes.js     # Tenant, plan, and API key routes
│   └── workers/
│       └── job.handlers.js      # Business logic handlers (Report generation, Emails, etc.)
└── .env.example                 # Environment variables template
```

---

## Getting Started

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Docker & Docker Compose](https://www.docker.com/)

### 2. Clone & Install Dependencies

```bash
git clone https://github.com/antrikshyagupta/Multi-Tenant-Task-Queue-Worker-Orchestration-Engine.git
cd Multi-Tenant-Task-Queue-Worker-Orchestration-Engine
npm install
```

### 3. Start Infrastructure Services

Spin up PostgreSQL and Redis using Docker Compose:

```bash
docker compose up -d
```

### 4. Configure Environment Variables

Copy the example environment file and adjust if necessary:

```bash
cp .env.example .env
```

Default variables:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/saas_db?schema=public"
PORT=3000
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

### 5. Run Database Migrations & Seed Plans

Apply database migrations and seed the subscription tiers (`free`, `pro`, `enterprise`):

```bash
# Run migrations
npx prisma migrate dev

# Seed subscription plans
npm run seed
```

### 6. Run the Application

You can run the API server and worker process separately:

**Start API Server:**
```bash
# Production mode
npm start

# Development mode (with nodemon reload)
npm run dev
```

**Start Background Worker:**
```bash
# Production mode
npm run worker

# Development mode (with nodemon reload)
npm run dev:worker
```

---

## Environment Variables

| Variable | Description | Default / Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/saas_db?schema=public` |
| `PORT` | API server port | `3000` |
| `REDIS_HOST` | Redis server hostname | `127.0.0.1` |
| `REDIS_PORT` | Redis server port | `6379` |

---

## Authentication & API Key Rotation

All protected endpoints require the `x-api-key` HTTP header:

```http
x-api-key: sk_live_...
```

**Key Lifecycle & Security:**
1. **Creation**: When registering or generating a key, a cryptographically secure random key prefixed with `sk_live_` is generated.
2. **Secure Hashing**: The raw key is hashed with **SHA-256** before saving. The raw secret is returned **only once** upon generation.
3. **Prefix Masking**: A safe prefix (`key_prefix`, e.g., `sk_live_a1b2c3`) is stored for safe listing and auditing without exposing the secret.
4. **Key Rotation & Revocation**: Tenants can maintain multiple active keys, rotate credentials seamlessly with zero downtime, and revoke compromised keys instantly.
5. **Usage Tracking**: Authenticated requests update `last_used_at` asynchronously. Revoked keys return `401 Unauthorized`.

---

## API Reference

### Health Check

#### Check Server Health
```http
GET /health
```
**Response (200 OK):**
```json
{
  "status": "ok",
  "message": "Platform API is alive!"
}
```

---

### Tenant & Key Management

#### 1. Register Tenant
Creates a new tenant, assigns the default `free` plan, and generates an initial API key.
```http
POST /api/v1/tenants/register
Content-Type: application/json

{
  "name": "Acme Corp"
}
```
**Response (201 Created):**
```json
{
  "message": "Tenant registered successfully. Save this API key now—it will not be shown again.",
  "api_key": "sk_live_1a2b3c4d5e6f7g8h9i0j...",
  "tenant": {
    "id": "c1f71df8-3d12-4c28-98e3-0c46dfc8e11b",
    "name": "Acme Corp",
    "status": "active",
    "plan": {
      "id": "8b0c2e34-5f12-4a7b-9cde-123456789abc",
      "name": "free",
      "max_concurrent_jobs": 2,
      "max_queued_jobs": 20,
      "rate_limit_per_min": 30,
      "max_payload_bytes": 32768,
      "weight": 1
    },
    "created_at": "2026-11-15T18:00:00.000Z"
  }
}
```

#### 2. Get Tenant Profile
```http
GET /api/v1/tenants/me
x-api-key: sk_live_...
```
**Response (200 OK):**
```json
{
  "tenant": {
    "id": "c1f71df8-3d12-4c28-98e3-0c46dfc8e11b",
    "name": "Acme Corp",
    "status": "active",
    "plan": {
      "name": "free",
      "rate_limit_per_min": 30,
      "max_queued_jobs": 20,
      "max_payload_bytes": 32768
    },
    "created_at": "2026-11-15T18:00:00.000Z"
  }
}
```

#### 3. Update / Switch Plan
Upgrade or downgrade subscription tier (`free`, `pro`, `enterprise`).
```http
PATCH /api/v1/tenants/plan
x-api-key: sk_live_...
Content-Type: application/json

{
  "plan_name": "pro"
}
```
**Response (200 OK):**
```json
{
  "message": "Switched to \"pro\" plan successfully",
  "plan": {
    "name": "pro",
    "max_concurrent_jobs": 10,
    "max_queued_jobs": 500,
    "rate_limit_per_min": 120,
    "max_payload_bytes": 262144,
    "weight": 3
  }
}
```

#### 4. Create / Rotate API Key
```http
POST /api/v1/tenants/api-keys
x-api-key: sk_live_...
Content-Type: application/json

{
  "name": "Production Worker Key"
}
```
**Response (201 Created):**
```json
{
  "message": "New API key created. Save it now—it will not be shown again.",
  "api_key": "sk_live_9z8y7x6w5v4u...",
  "key_details": {
    "id": "d4e5f6a7-1234-5678-90ab-cdef12345678",
    "name": "Production Worker Key",
    "key_prefix": "sk_live_9z8y7x",
    "is_active": true,
    "created_at": "2026-11-16T00:00:00.000Z"
  }
}
```

#### 5. List API Keys
Safely lists all keys associated with the tenant without exposing hashes.
```http
GET /api/v1/tenants/api-keys
x-api-key: sk_live_...
```
**Response (200 OK):**
```json
{
  "api_keys": [
    {
      "id": "d4e5f6a7-1234-5678-90ab-cdef12345678",
      "name": "Production Worker Key",
      "key_prefix": "sk_live_9z8y7x",
      "is_active": true,
      "revoked_at": null,
      "last_used_at": "2026-11-16T00:05:00.000Z",
      "created_at": "2026-11-16T00:00:00.000Z"
    }
  ]
}
```

#### 6. Revoke API Key
Instantly deactivates an API key.
```http
DELETE /api/v1/tenants/api-keys/:id
x-api-key: sk_live_...
```
**Response (200 OK):**
```json
{
  "message": "API key revoked successfully"
}
```

---

### Job Endpoints

#### 1. Queue a Background Job
Queues a background job scoped to the authenticated tenant. Enforces rate limits, payload size limits, and queued job limits.

```http
POST /api/v1/jobs
x-api-key: sk_live_...
Content-Type: application/json

{
  "type": "GENERATE_REPORT",
  "payload": {
    "reportType": "FINANCIAL_SUMMARY",
    "month": "October 2026"
  },
  "priority": 1,
  "delay": 5000,
  "idempotency_key": "job-fin-oct-2026"
}
```

**Parameters:**

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | String | Yes | Registered job handler (e.g., `GENERATE_REPORT`, `SEND_WELCOME_EMAIL`) |
| `payload` | Object | No | Arbitrary JSON data (governed by plan's `max_payload_bytes`) |
| `priority` | Number | No | Queue priority (lower number = higher priority, default: `5`) |
| `delay` | Number | No | Milliseconds to wait before processing (default: `0`) |
| `idempotency_key` | String | No | Unique client key to prevent duplicate job execution |

**Response (202 Accepted):**
```json
{
  "message": "Job queued successfully",
  "job": {
    "id": "8fa765b2-2ff8-4ca7-9c9f-3e11d04423b0",
    "tenant_id": "c1f71df8-3d12-4c28-98e3-0c46dfc8e11b",
    "type": "GENERATE_REPORT",
    "payload": {
      "reportType": "FINANCIAL_SUMMARY",
      "month": "October 2026"
    },
    "status": "QUEUED",
    "priority": 1,
    "scheduled_at": "2026-11-16T00:00:05.000Z",
    "idempotency_key": "job-fin-oct-2026",
    "created_at": "2026-11-16T00:00:00.000Z",
    "updated_at": "2026-11-16T00:00:00.000Z"
  }
}
```

**Idempotent Duplicate Response (200 OK):**
```json
{
  "message": "Duplicate request ignored (idempotency key matched)",
  "job": {
    "id": "8fa765b2-2ff8-4ca7-9c9f-3e11d04423b0",
    "status": "QUEUED",
    "idempotency_key": "job-fin-oct-2026"
  }
}
```

#### 2. List Jobs (Paginated)
Fetch tenant's jobs with pagination and optional status filter.

```http
GET /api/v1/jobs?page=1&limit=10&status=COMPLETED
x-api-key: sk_live_...
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "8fa765b2-2ff8-4ca7-9c9f-3e11d04423b0",
      "type": "GENERATE_REPORT",
      "status": "COMPLETED",
      "priority": 1,
      "created_at": "2026-11-16T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

#### 3. Get Job Details & Execution History
Fetch complete job details including all execution attempts, worker ID, durations, and errors.

```http
GET /api/v1/jobs/:id
x-api-key: sk_live_...
```

**Response (200 OK):**
```json
{
  "job": {
    "id": "8fa765b2-2ff8-4ca7-9c9f-3e11d04423b0",
    "tenant_id": "c1f71df8-3d12-4c28-98e3-0c46dfc8e11b",
    "type": "GENERATE_REPORT",
    "payload": { "month": "October 2026" },
    "status": "COMPLETED",
    "priority": 1,
    "created_at": "2026-11-16T00:00:00.000Z",
    "executions": [
      {
        "id": "e1f2a3b4-5678-90ab-cdef-1234567890ab",
        "worker_id": "worker-node-1-4128",
        "attempt_number": 1,
        "status": "COMPLETED",
        "started_at": "2026-11-16T00:00:02.000Z",
        "finished_at": "2026-11-16T00:00:04.000Z",
        "execution_duration": 2004,
        "error_message": null
      }
    ]
  }
}
```

#### 4. Cancel a Queued Job
Cancels a job that is still waiting in `QUEUED` status, removing it from BullMQ/Redis and updating PostgreSQL status to `CANCELLED`.

```http
PATCH /api/v1/jobs/:id/cancel
x-api-key: sk_live_...
```

**Response (200 OK):**
```json
{
  "message": "Job cancelled successfully",
  "job": {
    "id": "8fa765b2-2ff8-4ca7-9c9f-3e11d04423b0",
    "status": "CANCELLED"
  }
}
```

---

## Worker Engine & Lifecycle

The background worker process (`worker.js`) runs decoupled from the web tier:

1. **Worker Identification**: Each worker identifies itself using `worker-<hostname>-<pid>` to provide transparent audit trails across distributed worker pools.
2. **Concurrency**: Default concurrency of `5` parallel jobs per worker process.
3. **Execution Timeout**: 30-second hard execution timeout per job (`timeout: 30000`) prevents runaway tasks from hanging workers.
4. **Execution Tracking**:
   - Updates `Job.status` to `PROCESSING`.
   - Creates an `Execution` record with `RUNNING` status, recording attempt count, worker ID, and start timestamp.
5. **Completion**:
   - Executes handler from `src/workers/job.handlers.js`.
   - Runs an atomic Prisma transaction marking `Execution` as `COMPLETED` (recording duration in ms) and `Job` as `COMPLETED`.
6. **Failure & Exponential Backoff Retry**:
   - Logs failures in `Execution` table with duration and error message.
   - Retries up to `3` times with exponential backoff (1s, 2s, 4s).
   - Keeps `Job.status` as `QUEUED` while retries remain; marks `FAILED` only after retries are exhausted.
7. **Graceful Shutdown**: Intercepts `SIGINT` and `SIGTERM` signals to cleanly drain active jobs, disconnect from Prisma, and close Redis connections.

---

## Adding New Job Handlers

To add a new background task handler, register it in `src/workers/job.handlers.js`:

```javascript
const handlers = {
  // Existing handlers...

  SYNC_STRIPE_PAYMENTS: async (payload) => {
    console.log(`Syncing customer ${payload.customerId}...`);
    // Your processing logic here
    return { success: true };
  },
};
```

Clients can immediately queue jobs of type `SYNC_STRIPE_PAYMENTS`.

---

## License

ISC
