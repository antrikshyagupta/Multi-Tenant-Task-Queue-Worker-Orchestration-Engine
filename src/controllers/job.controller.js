const prisma = require('../config/prisma');
const jobQueue = require('../queues/job.queue');

const createJob = async (req, res, next) => {
  try {
    const { type, payload, priority = 5, delay = 0, idempotency_key } = req.body;

    if (!type || typeof type !== 'string') {
      return res.status(400).json({ error: 'Valid job "type" is required' });
    }

    // Optional Idempotency Check: return existing job if key was already used
    if (idempotency_key) {
      const existingJob = await prisma.job.findUnique({
        where: { idempotency_key },
      });
      if (existingJob) {
        return res.status(200).json({
          message: 'Duplicate request ignored (idempotency key matched)',
          job: existingJob,
        });
      }
    }

    const scheduledAt = delay > 0 ? new Date(Date.now() + Number(delay)) : null;

    // 1. Save durable record in PostgreSQL scoped to req.tenant.id
    const job = await prisma.job.create({
      data: {
        tenant_id: req.tenant.id,
        type,
        payload: payload || {},
        status: 'QUEUED',
        priority: Number(priority),
        scheduled_at: scheduledAt,
        idempotency_key: idempotency_key || null,
      },
    });

    // 2. Enqueue job into BullMQ (Redis)
    await jobQueue.add(
      type,
      {
        jobId: job.id,
        tenantId: req.tenant.id,
        type,
        payload: job.payload,
      },
      {
        jobId: job.id,
        priority: Number(priority),
        delay: Number(delay) > 0 ? Number(delay) : 0,
      }
    );

    return res.status(202).json({
      message: 'Job queued successfully',
      job,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createJob,
};