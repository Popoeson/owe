const express = require('express');
const router = express.Router();
const { initiateRegistration, getPaymentStatus, manualVerify, getPaymentDetails } = require('../controllers/paymentController');

router.post('/register/initiate', initiateRegistration);
router.get('/payments/:reference/status', getPaymentStatus);
router.post('/payments/:reference/verify', manualVerify);
router.get('/payments/:reference', getPaymentDetails);

module.exports = router;