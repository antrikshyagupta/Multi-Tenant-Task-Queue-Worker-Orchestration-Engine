const redisConnection = require('../config/redis');
const prisma = require('../config/prisma');

// Default fallback limits if a tenant has no plan assigned
const DEFAULT_LIMITS = {
  max_concurrent_jobs: 2,
  max_queued_jobs: 20,
  rate_limit_per_min: 30,
  max_payload_bytes: 32768,
};

/**
 * 1. Per-Tenant API Rate Limiter (Redis Fixed-Window Counter)
 */
const rateLimitTenant = async (req, res, next) => {
  try {
    const plan = req.tenant.plan || DEFAULT_LIMITS;
    const limit = plan.rate_limit_per_min;

    // Bucket key per tenant per minute
    const currentMinute = Math.floor(Date.now() / 60000);
    const redisKey = `ratelimit:${req.tenant.id}:${currentMinute}`;

    const currentCount = await redisConnection.incr(redisKey);
    if (currentCount === 1) {
      await redisConnection.expire(redisKey, 60);
    }

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - currentCount));

    if (currentCount > limit) {
      return res.status(429).json({
        error: `Rate limit exceeded. Plan allows ${limit} requests per minute.`,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Job Submission Quota Check (Payload Size + Max Queued Jobs)
 */
const checkJobQuotas = async (req, res, next) => {
  try {
    const plan = req.tenant.plan || DEFAULT_LIMITS;

    // A. Payload Size Validation
    const payloadString = JSON.stringify(req.body.payload || {});
    const payloadBytes = Buffer.byteLength(payloadString, 'utf8');

    if (payloadBytes > plan.max_payload_bytes) {
      return res.status(413).json({
        error: `Payload size (${payloadBytes} bytes) exceeds plan limit of ${plan.max_payload_bytes} bytes.`,
      });
    }

    // B. Max Queued Jobs Validation
    const queuedCount = await prisma.job.count({
      where: {
        tenant_id: req.tenant.id,
        status: 'QUEUED',
      },
    });

    if (queuedCount >= plan.max_queued_jobs) {
      return res.status(429).json({
        error: `Queued job quota exceeded (${queuedCount}/${plan.max_queued_jobs}). Upgrade your plan or wait for queued jobs to finish.`,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  rateLimitTenant,
  checkJobQuotas,
};