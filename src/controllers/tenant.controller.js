const crypto = require('crypto');
const prisma = require('../config/prisma');

// Helper to generate a raw sk_live_ key, its prefix, and its SHA-256 hash
const generateApiKeyPair = () => {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const rawKey = `sk_live_${randomBytes}`;
  const keyPrefix = rawKey.slice(0, 14); // e.g., "sk_live_a1b2c3"
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  return { rawKey, keyPrefix, keyHash };
};

// 1. POST /api/v1/tenants/register
const registerTenant = async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Tenant "name" is required' });
    }

    const freePlan = await prisma.plan.findUnique({ where: { name: 'free' } });
    const { rawKey, keyPrefix, keyHash } = generateApiKeyPair();

    const tenant = await prisma.tenant.create({
      data: {
        name,
        plan_id: freePlan ? freePlan.id : null,
        api_keys: {
          create: {
            name: 'Default Key',
            key_prefix: keyPrefix,
            key_hash: keyHash,
          },
        },
      },
      include: {
        plan: true,
      },
    });

    return res.status(201).json({
      message: 'Tenant registered successfully. Save this API key now—it will not be shown again.',
      api_key: rawKey,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        status: tenant.status,
        plan: tenant.plan,
        created_at: tenant.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. GET /api/v1/tenants/me
const getTenantProfile = async (req, res, next) => {
  try {
    return res.status(200).json({
      tenant: {
        id: req.tenant.id,
        name: req.tenant.name,
        status: req.tenant.status,
        plan: req.tenant.plan,
        created_at: req.tenant.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 3. PATCH /api/v1/tenants/plan (Upgrade/downgrade plan)
const updateTenantPlan = async (req, res, next) => {
  try {
    const { plan_name } = req.body;

    if (!plan_name) {
      return res.status(400).json({ error: '"plan_name" is required (e.g., "free", "pro", "enterprise")' });
    }

    const plan = await prisma.plan.findUnique({
      where: { name: plan_name.toLowerCase() },
    });

    if (!plan) {
      return res.status(404).json({ error: `Plan "${plan_name}" not found` });
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: req.tenant.id },
      data: { plan_id: plan.id },
      include: { plan: true },
    });

    return res.status(200).json({
      message: `Switched to "${plan.name}" plan successfully`,
      plan: updatedTenant.plan,
    });
  } catch (error) {
    next(error);
  }
};

// 4. POST /api/v1/tenants/api-keys (Create / Rotate API Key)
const createApiKey = async (req, res, next) => {
  try {
    const { name = 'Rotated Key' } = req.body;
    const { rawKey, keyPrefix, keyHash } = generateApiKeyPair();

    const apiKey = await prisma.apiKey.create({
      data: {
        tenant_id: req.tenant.id,
        name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
      },
    });

    return res.status(201).json({
      message: 'New API key created. Save it now—it will not be shown again.',
      api_key: rawKey,
      key_details: {
        id: apiKey.id,
        name: apiKey.name,
        key_prefix: apiKey.key_prefix,
        is_active: apiKey.is_active,
        created_at: apiKey.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 5. GET /api/v1/tenants/api-keys (List tenant's keys safely without hashes)
const listApiKeys = async (req, res, next) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { tenant_id: req.tenant.id },
      select: {
        id: true,
        name: true,
        key_prefix: true,
        is_active: true,
        revoked_at: true,
        last_used_at: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return res.status(200).json({ api_keys: keys });
  } catch (error) {
    next(error);
  }
};

// 6. DELETE /api/v1/tenants/api-keys/:id (Revoke an API key)
const revokeApiKey = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingKey = await prisma.apiKey.findFirst({
      where: {
        id,
        tenant_id: req.tenant.id, // Tenant isolation
      },
    });

    if (!existingKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    if (!existingKey.is_active) {
      return res.status(400).json({ error: 'API key is already revoked' });
    }

    await prisma.apiKey.update({
      where: { id },
      data: {
        is_active: false,
        revoked_at: new Date(),
      },
    });

    return res.status(200).json({ message: 'API key revoked successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerTenant,
  getTenantProfile,
  updateTenantPlan,
  createApiKey,
  listApiKeys,
  revokeApiKey,
};