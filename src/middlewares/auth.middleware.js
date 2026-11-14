const crypto = require('crypto');
const prisma = require('../config/prisma');


async function authenticateTenant(req, res, next) {
    try {
        //read key from headers
        const rawApiKey = req.header('x-api-key');

        if (!rawApiKey) {
            return res.status(401).json({ error: 'Missing x-api-key Header' });
        }

        //hash the raw key to mathc with db
        const apiKeyHash = crypto
            .createHash('sha256')
            .update(rawApiKey)
            .digest('hex');

        //find the hash key in db
    const tenant = await prisma.tenant.findUnique({
    where: { api_key_hash: apiKeyHash },
    });

    if (!tenant || tenant.status !== 'active') {
      return res.status(401).json({ error: 'Invalid or inactive API key' });
    }

    // Attaching the verified tenant to the request object for downstream controllers
    req.tenant = tenant;

    // pass control to the next handler
    next();
    }catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

}

module.exports = { authenticateTenant };