require('dotenv').config();
const { Worker } = require('bullmq');
const os = require('os');
const redisConnection = require('./src/config/redis');
const prisma = require('./src/config/prisma');
const { executeJobHandler } = require('./src/workers/job.handlers');
const logger = require('./src/config/logger');

const WORKER_ID = `worker-${os.hostname()}-${process.pid}`;

const worker = new Worker(
  'background-jobs',
  async (bullJob) => {
    const { jobId, type, payload } = bullJob.data;
    const attemptNumber = bullJob.attemptsMade + 1;
    const startedAt = new Date();
    let execution = null;

    console.log(`[${WORKER_ID}] Picked up job ${jobId} (${type}) - Attempt #${attemptNumber}`);

    try {
      // 1. Mark Job as PROCESSING and create Execution record inside try block
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'PROCESSING' },
      });

      execution = await prisma.execution.create({
        data: {
          job_id: jobId,
          worker_id: WORKER_ID,
          attempt_number: attemptNumber,
          status: 'RUNNING',
          started_at: startedAt,
        },
      });

      // 2. Execute the actual job handler
      const result = await executeJobHandler(type, payload);
      const finishedAt = new Date();
      const durationMs = finishedAt - startedAt;

      // 3. Mark Execution and Job as COMPLETED
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
      const maxAttempts = bullJob.opts.attempts ?? 3; // Fall back to queue default (3)
      const isFinalAttempt = attemptNumber >= maxAttempts;

      // 4. Record failure safely (only update execution if it was created)
      const dbUpdates = [
        prisma.job.update({
          where: { id: jobId },
          data: {
            status: isFinalAttempt ? 'FAILED' : 'QUEUED',
          },
        }),
      ];

      if (execution) {
        dbUpdates.unshift(
          prisma.execution.update({
            where: { id: execution.id },
            data: {
              status: 'FAILED',
              finished_at: finishedAt,
              execution_duration: durationMs,
              error_message: error.message,
            },
          })
        );
      }

      await prisma.$transaction(dbUpdates);

      logger.error(
        `[${WORKER_ID}] Job ${jobId} failed (Attempt #${attemptNumber}/${maxAttempts}): ${error.message}`
      );
      throw error; // Re-throw so BullMQ triggers exponential backoff retry
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
    timeout: 30000, // 30-second hard execution timeout per job
  }
);

worker.on('ready', () => {
  console.log(`[${WORKER_ID}] Worker is online and listening for jobs...`);
});

const shutdown = async () => {
  console.log(`\n[${WORKER_ID}] Shutting down gracefully...`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);