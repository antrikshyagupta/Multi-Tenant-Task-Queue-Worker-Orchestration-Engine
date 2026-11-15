const express = require('express');
const router = express.Router();
const { createJob } = require('../controllers/job.controller');
const {authenticateTenant} = require('../middlewares/auth.middleware');

router.post('/', authenticateTenant, createJob);

module.exports = router;