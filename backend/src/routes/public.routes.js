const express = require('express');
const router = express.Router();
const { initiateRegistration, getPaymentStatus, manualVerify, getPaymentDetails } = require('../controllers/paymentController');
const { getStatBoard, initiateVote } = require('../controllers/voteController');
const { getStatBoard, initiateVote, listEndedSessions, getSessionDetail } = require('../controllers/voteController');

router.post('/register/initiate', initiateRegistration);
router.get('/payments/:reference/status', getPaymentStatus);
router.post('/payments/:reference/verify', manualVerify);
router.get('/payments/:reference', getPaymentDetails);
router.get('/stat-board', getStatBoard);
router.post('/vote/initiate', initiateVote);
router.get('/stat-board', getStatBoard);
router.post('/vote/initiate', initiateVote);
router.get('/sessions', listEndedSessions);
router.get('/sessions/:id', getSessionDetail);

module.exports = router;