const crypto = require('crypto');
const prisma = require('../config/prisma');


// POST /api/v1/tenants/register
async function registerTenant(req, res) {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Tenant name is required' });
    }

    // 1. Generate a raw API key 
    const rawApiKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;

    // 2. Hash the key using SHA-256 before saving to the DB
    const apiKeyHash = crypto
      .createHash('sha256')
      .update(rawApiKey)
      .digest('hex');

    // 3. Save the tenant to PostgreSQL
    const tenant = await prisma.tenant.create({
      data: {
        name,
        api_key_hash: apiKeyHash,
      },
    });

    // 4. Return the tenant details AND the raw key (only shown once!)
    return res.status(201).json({
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      apiKey: rawApiKey,
      message: 'Save this API key securely. You will not be able to view it again.',
    });
  } catch (error) {
    console.error('Error registering tenant:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}



// GET /api/v1/tenants/me

async function getTenantProfile (req , res){
// req.tenant which was attached by authenticateTenant middleware
return res.json({
    id: req.tenant.id,
    name: req.tenant.name,
    status: req.tenant.status,
    plan_id: req.tenant.plan_id,
    created_at: req.tenant.created_at,
  });
}
module.exports = { registerTenant , getTenantProfile };