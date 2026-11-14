const express = require('express');
const { registerTenant , getTenantProfile } = require('../controllers/tenant.controller');
const { authenticateTenant } = require('../middlewares/auth.middleware');

const router = express.Router() ;



// post method -> registering tenant
router.post('/register' , registerTenant);


//protected route i.e authenticate before getting tenant's profile
router.get('/me', authenticateTenant, getTenantProfile);



module.exports = router ;