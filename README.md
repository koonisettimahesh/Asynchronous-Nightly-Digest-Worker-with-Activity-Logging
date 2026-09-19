# Asynchronous Nightly Digest Worker with Activity Logging

A containerized backend system for processing **nightly digest jobs asynchronously** using **Node.js, TypeScript, Express, BullMQ, Redis, and PostgreSQL**.

The system provides:

* Asynchronous background job processing
* Manual job triggering through a REST API
* Scheduled nightly digest execution using cron
* Detailed job activity logging
* Success and failure simulation
* Dead-letter state handling
* PostgreSQL persistence
* Redis-backed BullMQ queue
* Fully containerized development environment

---

## Architecture

```text
                    ┌──────────────────────┐
                    │      REST API        │
                    │      Express         │
                    └──────────┬───────────┘
                               │
                         Create Job
                               │
                               ▼
                    ┌──────────────────────┐
                    │     BullMQ Queue     │
                    │       Redis          │
                    └──────────┬───────────┘
                               │
                         Background Job
                               │
                               ▼
                    ┌──────────────────────┐
                    │       Worker         │
                    │      BullMQ          │
                    └──────────┬───────────┘
                               │
                     Process & Log State
                               │
                               ▼
                    ┌──────────────────────┐
                    │     PostgreSQL       │
                    │ jobs + activity logs │
                    └──────────────────────┘

              ┌─────────────────────────────┐
              │       Cron Scheduler        │
              │       node-cron             │
              └─────────────┬───────────────┘
                            │
                            ▼
                       BullMQ Queue
```

### Job Lifecycle

Successful job:

```text
pending → started → success
```

Failed job:

```text
pending → started → failed → dead_letter
```

---

## Tech Stack

| Technology     | Purpose                          |
| -------------- | -------------------------------- |
| Node.js        | Runtime                          |
| TypeScript     | Application language             |
| Express        | REST API                         |
| BullMQ         | Background job queue             |
| Redis          | Queue backend                    |
| PostgreSQL     | Persistent job and activity data |
| node-cron      | Nightly job scheduling           |
| Docker         | Containerization                 |
| Docker Compose | Multi-container orchestration    |

---

## Project Structure

```text
.
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── package.json
├── package-lock.json
├── submission.json
├── README.md
├── tsconfig.json
│
├── src/
│   ├── api/
│   │   ├── controllers/
│   │   │   ├── shared/
│   │   │   ├── triggerJobController.ts
│   │   │   └── getJobLogsController.ts
│   │   └── server.ts
│   │
│   ├── models/
│   │   ├── jobs.sql
│   │   └── job_activity_logs.sql
│   │
│   ├── queue/
│   │   └── index.ts
│   │
│   ├── scheduler/
│   │   └── index.ts
│   │
│   └── worker/
│       ├── index.ts
│       └── processor.ts
│
└── tests/
    ├── jobs.test.ts
    └── worker.test.ts
```

---

## Prerequisites

Make sure the following are installed:

* Docker
* Docker Compose
* Git

The application dependencies are installed inside the Docker containers.

---

## Environment Configuration

Create a `.env` file in the project root.

Example:

```env
PORT=3000
DATABASE_URL=postgres://postgres:postgres@db:5432/app
REDIS_URL=redis://queue:6379
NIGHTLY_DIGEST_CRON=0 0 * * *
```

The `.env.example` file contains the environment variables required by the application.

> Do not commit real secrets to the repository.

---

## Running the Application

Build and start all services:

```bash
docker compose up -d --build
```

Check the service status:

```bash
docker compose ps
```

The expected services are:

```text
app
worker
db
queue
```

All services should become healthy/running.

### Health Check

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

---

## API Endpoints

### 1. Trigger a Job

**Endpoint**

```http
POST /api/jobs/trigger
```

**Request**

```json
{
  "type": "nightly_digest",
  "simulate_failure": false
}
```

`simulate_failure` is optional and defaults to `false`.

**Successful response**

HTTP `202 Accepted`

```json
{
  "job_id": "067aa748-5880-4022-a86c-dd7424992d1c",
  "message": "Job queued successfully"
}
```

The API returns immediately while the worker processes the job asynchronously.

### Example

```bash
curl -X POST http://localhost:3000/api/jobs/trigger \
  -H "Content-Type: application/json" \
  -d '{"type":"nightly_digest","simulate_failure":false}'
```

---

### 2. Get Job Activity Logs

**Endpoint**

```http
GET /api/jobs/{job_id}/logs
```

Example:

```bash
curl http://localhost:3000/api/jobs/<JOB_ID>/logs
```

Example response:

```json
{
  "job_id": "067aa748-5880-4022-a86c-dd7424992d1c",
  "current_state": "success",
  "logs": [
    {
      "state": "pending",
      "message": "Job created and queued for processing",
      "created_at": "2026-09-19T09:03:09.612Z"
    },
    {
      "state": "started",
      "message": "Worker picked up job for nightly_digest",
      "created_at": "2026-09-19T09:03:09.703Z"
    },
    {
      "state": "success",
      "message": "Nightly digest completed successfully for nightly_digest",
      "created_at": "2026-09-19T09:03:11.725Z"
    }
  ]
}
```

If the requested job does not exist, the API returns HTTP `404`.

---

## Failure Simulation

A failure can be intentionally injected by setting:

```json
{
  "type": "nightly_digest",
  "simulate_failure": true
}
```

Example:

```bash
curl -X POST http://localhost:3000/api/jobs/trigger \
  -H "Content-Type: application/json" \
  -d '{"type":"nightly_digest","simulate_failure":true}'
```

The expected state transition is:

```text
pending → started → failed → dead_letter
```

The final job state is:

```json
{
  "current_state": "dead_letter"
}
```

The `dead_letter` state is persisted in PostgreSQL to represent the terminal dead-letter state for deterministic failure testing.

---

## Scheduled Nightly Jobs

The application includes an active cron scheduler using `node-cron`.

The default schedule is:

```text
0 0 * * *
```

which represents a nightly execution at midnight.

The schedule can be configured through:

```env
NIGHTLY_DIGEST_CRON=0 0 * * *
```

The scheduler creates a job and places it onto the same BullMQ queue used by manually triggered jobs.

---

## Database

The application uses PostgreSQL with two main tables.

### `jobs`

Stores the parent job information and current state.

### `job_activity_logs`

Stores the chronological activity history for each job.

The activity log references the corresponding job through a foreign key.

Database initialization is performed automatically when the PostgreSQL container is created.

---

## Testing

The project includes tests under:

```text
tests/
├── jobs.test.ts
└── worker.test.ts
```

The system can also be verified manually through the API.

### Success Flow

```bash
curl -X POST http://localhost:3000/api/jobs/trigger \
  -H "Content-Type: application/json" \
  -d '{"type":"nightly_digest","simulate_failure":false}'
```

Then retrieve the logs using the returned `job_id`.

Expected:

```text
pending → started → success
```

### Failure Flow

```bash
curl -X POST http://localhost:3000/api/jobs/trigger \
  -H "Content-Type: application/json" \
  -d '{"type":"nightly_digest","simulate_failure":true}'
```

Then retrieve the logs.

Expected:

```text
pending → started → failed → dead_letter
```

---

## Stopping the Application

Stop the containers:

```bash
docker compose down
```

To stop the containers and remove the associated volumes:

```bash
docker compose down -v
```

To rebuild everything from scratch:

```bash
docker compose down -v
docker compose up -d --build
```

---

## Configuration

| Variable              | Description                               |
| --------------------- | ----------------------------------------- |
| `PORT`                | API server port                           |
| `DATABASE_URL`        | PostgreSQL connection string              |
| `REDIS_URL`           | Redis connection string                   |
| `NIGHTLY_DIGEST_CRON` | Cron expression for scheduled digest jobs |

---

## Key Design Decisions

### Asynchronous Processing

The API does not wait for the digest processing to complete. It creates the job, records the initial activity, places the job on the queue, and immediately returns HTTP `202`.

### BullMQ + Redis

BullMQ provides reliable background job queueing while Redis acts as the queue backend.

### PostgreSQL Activity Logging

Each important state transition is persisted in PostgreSQL, making the complete job lifecycle queryable through the logs API.

### Deterministic Failure Testing

The `simulate_failure` option allows the failure path to be tested without depending on an external failure.

---

## License

This project was developed as part of a backend engineering assignment.
