const express = require('express');
const router = express.Router();
const {
  createJob,
  listJobs,
  getJobById,
  cancelJob,
} = require('../controllers/job.controller');
const { authenticateTenant } = require('../middlewares/auth.middleware');
const { rateLimitTenant, checkJobQuotas } = require('../middlewares/quota.middleware');

router.use(authenticateTenant);
router.use(rateLimitTenant);

router.post('/', checkJobQuotas, createJob);
router.get('/', listJobs);
router.get('/:id', getJobById);
router.patch('/:id/cancel', cancelJob);

module.exports = router;