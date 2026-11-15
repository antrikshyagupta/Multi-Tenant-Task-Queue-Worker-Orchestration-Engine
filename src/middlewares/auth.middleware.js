const crypto = require('crypto');
const prisma = require('../config/prisma');

const authenticateTenant = async (req, res, next) => {
  try {
    const apiKey = req.header('x-api-key');

    if (!apiKey) {
      return res.status(401).json({ error: 'Missing x-api-key header' });
    }

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // 1. Check dedicated ApiKey table first (supports key rotation & revocation)
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { key_hash: keyHash },
      include: {
        tenant: {
          include: { plan: true },
        },
      },
    });

    let tenant = null;

    if (apiKeyRecord) {
      if (!apiKeyRecord.is_active || apiKeyRecord.revoked_at) {
        return res.status(401).json({ error: 'API key has been revoked' });
      }
      tenant = apiKeyRecord.tenant;
      // Fire-and-forget update of last_used_at
      prisma.apiKey
        .update({
          where: { id: apiKeyRecord.id },
          data: { last_used_at: new Date() },
        })
        .catch(() => {});
    } else {
      // 2. Fallback to legacy Tenant.api_key_hash so existing test keys keep working
      tenant = await prisma.tenant.findUnique({
        where: { api_key_hash: keyHash },
        include: { plan: true },
      });
    }

    if (!tenant || tenant.status !== 'active') {
      return res.status(401).json({ error: 'Invalid or inactive API key' });
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticateTenant,
};