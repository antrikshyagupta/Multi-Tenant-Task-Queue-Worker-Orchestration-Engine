# Multi-Tenant Task Queue & Worker Orchestration Engine

A robust, multi-tenant SaaS backend platform for background job queuing, delayed task scheduling, idempotency control, and worker orchestration. Built with Node.js, Express 5, PostgreSQL, Prisma ORM, BullMQ, and Redis.

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
                      │  - Auth Middleware (SHA-256 API Key)     │
                      │  - Idempotency & Tenant Scoping          │
                      └─────────────┬──────────────────┬─────────┘
                                    │                  │
                1. Persist Job (Durable)       2. Enqueue Job
                                    ▼                  ▼
                      ┌──────────────────┐    ┌──────────────────┐
                      │ PostgreSQL DB    │    │ Redis (BullMQ)   │
                      │ - Tenants        │    │ - Task Queues    │
                      │ - Jobs           │    │ - Delayed Jobs   │
                      │ - Executions     │    │ - Priority Queue │
                      └──────────────────┘    └────────┬─────────┘
                                                       │
                                          3. Pull Jobs (Concurrency: 5)
                                                       ▼
                                      ┌──────────────────────────────────┐
                                      │   Worker Process (worker.js)     │
                                      │   - Worker ID Tracking           │
                                      │   - Attempt & Duration Logging   │
                                      │   - Automatic Exponential Retry  │
                                      │   - Handlers (Report, Email,...) │
                                      └──────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Runtime** | Node.js | CommonJS modules |
| **Framework** | Express 5 | REST API framework |
| **Database** | PostgreSQL | Relational storage for tenants, jobs, and execution history |
| **ORM** | Prisma | Schema definitions, type safety, and database migrations |
| **Queue & Broker** | BullMQ & Redis | Redis-backed distributed task queue with priority & delays |
| **Authentication** | Custom Middleware | SHA-256 hashed API keys scoped to tenants (`x-api-key`) |
| **Infrastructure** | Docker Compose | Local containerized PostgreSQL and Redis services |

---

## Data Models

The Prisma schema defines three primary models:

- **`Tenant`**: Organizations registered on the platform. Stores organization metadata, subscription plan, status, and SHA-256 hashed API keys.
- **`Job`**: Tenant-scoped background tasks with job `type`, JSON `payload`, `priority`, `scheduled_at`, `status` (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`), and unique `idempotency_key`.
- **`Execution`**: Historical audit log of every execution attempt. Tracks `worker_id`, `attempt_number`, `status` (`RUNNING`, `COMPLETED`, `FAILED`), `execution_duration` (ms), error messages, and timestamps.

---

## Project Structure

```
├── docker-compose.yml           # PostgreSQL and Redis services
├── package.json                 # Dependencies and npm scripts
├── server.js                    # API server entry point
├── worker.js                    # Background worker process entry point
├── prisma/
│   ├── schema.prisma            # Database schema & relations
│   └── migrations/              # Prisma migration history
├── src/
│   ├── app.js                   # Express application and route mounting
│   ├── config/
│   │   ├── prisma.js            # Prisma client singleton
│   │   └── redis.js             # IORedis connection configuration
│   ├── controllers/
│   │   ├── job.controller.js    # Job validation, idempotency & queue dispatch
│   │   └── tenant.controller.js # Tenant registration & profile retrieval
│   ├── middlewares/
│   │   └── auth.middleware.js   # API key authentication & tenant resolution
│   ├── queues/
│   │   └── job.queue.js         # BullMQ queue configuration & retry policies
│   ├── routes/
│   │   ├── job.routes.js        # Job API routes
│   │   └── tenant.routes.js     # Tenant API routes
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

### 5. Run Database Migrations

Apply database migrations and generate the Prisma Client:

```bash
npx prisma migrate dev
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

## Authentication

All protected endpoints require the `x-api-key` HTTP header:

```http
x-api-key: sk_live_...
```

**How It Works:**
1. When a tenant registers, a raw API key prefixed with `sk_live_` is generated using `crypto.randomBytes(32)`.
2. The key is hashed using **SHA-256** and saved in PostgreSQL. The raw key is returned **only once** upon registration.
3. On incoming protected requests, `auth.middleware.js` hashes the provided key and retrieves the active tenant record, attaching it to `req.tenant`.
4. Invalid, inactive, or missing keys result in a `401 Unauthorized` response.

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

### Tenant Endpoints

#### Register a New Tenant
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
  "id": "c1f71df8-3d12-4c28-98e3-0c46dfc8e11b",
  "name": "Acme Corp",
  "status": "active",
  "apiKey": "sk_live_1a2b3c4d5e6f...",
  "message": "Save this API key securely. You will not be able to view it again."
}
```

#### Get Current Tenant Profile
```http
GET /api/v1/tenants/me
x-api-key: sk_live_1a2b3c4d5e6f...
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

---

### Job Endpoints

#### Create / Queue a Background Job
Queues a background job scoped to the authenticated tenant. Supports priorities, delayed execution, and idempotency keys.

```http
POST /api/v1/jobs
x-api-key: sk_live_1a2b3c4d5e6f...
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
| `type` | String | Yes | Name of registered job handler (e.g., `GENERATE_REPORT`, `SEND_WELCOME_EMAIL`) |
| `payload` | Object | No | Arbitrary JSON data passed to the worker handler |
| `priority` | Number | No | Queue priority (lower number = higher priority, default: `5`) |
| `delay` | Number | No | Delay in milliseconds before job is eligible for processing (default: `0`) |
| `idempotency_key` | String | No | Unique client-provided key to prevent duplicate job execution |

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
    "scheduled_at": "2026-11-15T12:00:05.000Z",
    "idempotency_key": "job-fin-oct-2026",
    "created_at": "2026-11-15T12:00:00.000Z",
    "updated_at": "2026-11-15T12:00:00.000Z"
  }
}
```

**Idempotent Duplicate Response (200 OK):**
```json
{
  "message": "Duplicate request ignored (idempotency key matched)",
  "job": {
    "id": "8fa765b2-2ff8-4ca7-9c9f-3e11d04423b0",
    "tenant_id": "c1f71df8-3d12-4c28-98e3-0c46dfc8e11b",
    "type": "GENERATE_REPORT",
    "payload": { ... },
    "status": "QUEUED",
    "idempotency_key": "job-fin-oct-2026"
  }
}
```

---

## Worker Engine & Lifecycle

The worker process (`worker.js`) runs independently from the API server and processes jobs asynchronously:

1. **Worker Identification**: Each worker identifies itself using a unique identifier (`worker-<hostname>-<pid>`) to maintain an audit trail across distributed nodes.
2. **Concurrency**: Default concurrency of `5` parallel jobs per worker.
3. **Execution Tracking**:
   - Updates `Job.status` to `PROCESSING`.
   - Creates an `Execution` record with `RUNNING` status and records the start timestamp and attempt count.
4. **Completion**:
   - Executes handler from `src/workers/job.handlers.js`.
   - Runs an atomic Prisma transaction marking `Execution` as `COMPLETED` (calculating execution duration in milliseconds) and `Job` as `COMPLETED`.
5. **Failure & Exponential Backoff Retry**:
   - If a handler throws an error, the failure is logged in the `Execution` table with the error message and execution duration.
   - If attempts remain (default: `3` attempts with exponential backoff: 1s, 2s, 4s), the `Job` remains in `QUEUED` status for retry.
   - If all attempts are exhausted, the `Job` is updated to `FAILED`.
6. **Graceful Shutdown**: Intercepts `SIGINT` and `SIGTERM` signals to finish in-flight jobs, disconnect from Prisma, and close Redis connections cleanly.

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
