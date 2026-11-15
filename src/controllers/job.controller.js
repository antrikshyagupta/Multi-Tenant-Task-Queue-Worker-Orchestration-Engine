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

const listJobs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const { status } = req.query;

    const where = {
      tenant_id: req.tenant.id, // Strict tenant isolation
      ...(status ? { status: status.toUpperCase() } : {}),
    };

    const [jobs, total] = await prisma.$transaction([
      prisma.job.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    return res.status(200).json({
      data: jobs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getJobById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findFirst({
      where: {
        id,
        tenant_id: req.tenant.id, // Prevents Tenant B from inspecting Tenant A's job
      },
      include: {
        executions: {
          orderBy: { attempt_number: 'asc' },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.status(200).json({ job });
  } catch (error) {
    next(error);
  }
};

const cancelJob = async (req, res, next) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findFirst({
      where: {
        id,
        tenant_id: req.tenant.id,
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'QUEUED') {
      return res.status(400).json({
        error: `Cannot cancel job in "${job.status}" state. Only QUEUED jobs can be cancelled.`,
      });
    }

    // Remove from BullMQ/Redis if still waiting
    const bullJob = await jobQueue.getJob(id);
    if (bullJob) {
      await bullJob.remove();
    }

    // Update PostgreSQL status
    const updatedJob = await prisma.job.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return res.status(200).json({
      message: 'Job cancelled successfully',
      job: updatedJob,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createJob,
  listJobs,
  getJobById,
  cancelJob,
};
