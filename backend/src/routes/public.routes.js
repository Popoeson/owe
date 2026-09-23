const express = require('express');
const router = express.Router();
const { initiateRegistration, getPaymentStatus, manualVerify } = require('../controllers/paymentController');

router.post('/register/initiate', initiateRegistration);
router.get('/payments/:reference/status', getPaymentStatus);
router.post('/payments/:reference/verify', manualVerify);

module.exports = router;