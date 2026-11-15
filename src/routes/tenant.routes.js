const express = require('express');
const router = express.Router();
const {
  registerTenant,
  getTenantProfile,
  updateTenantPlan,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} = require('../controllers/tenant.controller');
const { authenticateTenant } = require('../middlewares/auth.middleware');

// Public route
router.post('/register', registerTenant);

// Protected tenant routes
router.get('/me', authenticateTenant, getTenantProfile);
router.patch('/plan', authenticateTenant, updateTenantPlan);
router.post('/api-keys', authenticateTenant, createApiKey);
router.get('/api-keys', authenticateTenant, listApiKeys);
router.delete('/api-keys/:id', authenticateTenant, revokeApiKey);

module.exports = router;