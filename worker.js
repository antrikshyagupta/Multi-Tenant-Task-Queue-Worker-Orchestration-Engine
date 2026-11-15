require('dotenv').config();
const { Worker } = require('bullmq');
const os = require('os');
const redisConnection = require('./src/config/redis');
const prisma = require('./src/config/prisma');
const { executeJobHandler } = require('./src/workers/job.handlers');

// Unique identifier for this worker process
const WORKER_ID = `worker-${os.hostname()}-${process.pid}`;

const worker = new Worker(
  'background-jobs',
  async (bullJob) => {
    const { jobId, type, payload } = bullJob.data;
    const attemptNumber = bullJob.attemptsMade + 1;
    const startedAt = new Date();

    console.log(`[${WORKER_ID}] Picked up job ${jobId} (${type}) - Attempt #${attemptNumber}`);

    // 1. Mark Job as PROCESSING in PostgreSQL
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'PROCESSING' },
    });

    // 2. Create an Execution attempt record in PostgreSQL
    const execution = await prisma.execution.create({
      data: {
        job_id: jobId,
        worker_id: WORKER_ID,
        attempt_number: attemptNumber,
        status: 'RUNNING',
        started_at: startedAt,
      },
    });
    
    try {
      // 3. Execute the actual job handler
      const result = await executeJobHandler(type, payload);
      const finishedAt = new Date();
      const durationMs = finishedAt - startedAt;

      // 4. Mark Execution and Job as COMPLETED
      await prisma.$transaction([
        prisma.execution.update({
          where: { id: execution.id },
          data: {
            status: 'COMPLETED',
            finished_at: finishedAt,
            execution_duration: durationMs,
          },
        }),
        prisma.job.update({
          where: { id: jobId },
          data: { status: 'COMPLETED' },
        }),
      ]);

      console.log(`[${WORKER_ID}] Completed job ${jobId} in ${durationMs}ms`);
      return result;
    } catch (error) {
      const finishedAt = new Date();
      const durationMs = finishedAt - startedAt;
      const isFinalAttempt = attemptNumber >= (bullJob.opts.attempts || 1);

      // 5. Record failure in Execution table; mark Job FAILED only if retries are exhausted
      await prisma.$transaction([
        prisma.execution.update({
          where: { id: execution.id },
          data: {
            status: 'FAILED',
            finished_at: finishedAt,
            execution_duration: durationMs,
            error_message: error.message,
          },
        }),
        prisma.job.update({
          where: { id: jobId },
          data: {
            status: isFinalAttempt ? 'FAILED' : 'QUEUED',
          },
        }),
      ]);

      console.error(`[${WORKER_ID}] Job ${jobId} failed (Attempt #${attemptNumber}): ${error.message}`);
      throw error; // Re-throw so BullMQ triggers exponential backoff retry
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 jobs concurrently in this worker
  }
);

worker.on('ready', () => {
  console.log(`[${WORKER_ID}] Worker is online and listening for jobs...`);
});

// Graceful shutdown on Ctrl+C or container stop
const shutdown = async () => {
  console.log(`\n[${WORKER_ID}] Shutting down gracefully...`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);