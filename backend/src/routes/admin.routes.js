const express = require('express');
const router = express.Router();
const requireAdmin = require('../middleware/requireAdmin');
const { login, logout, setup, session } = require('../controllers/authController');
const { getStats } = require('../controllers/dashboardController');
const performers = require('../controllers/performerAdminController');
const { listPayments } = require('../controllers/paymentAdminController');
const { getSettings, updateSettings } = require('../controllers/settingsAdminController');
const sessions = require('../controllers/sessionAdminController');
const tickets = require('../controllers/adminTicketController');

router.post('/login', login);
router.post('/logout', logout);
router.post('/setup', setup);
router.get('/session', requireAdmin, session);

router.get('/dashboard', requireAdmin, getStats);

router.get('/performers', requireAdmin, performers.listPerformers);
router.post('/performers', requireAdmin, performers.onboardPerformer);
router.patch('/performers/:id/approve', requireAdmin, performers.approvePerformer);
router.patch('/performers/:id/reject', requireAdmin, performers.rejectPerformer);
router.patch('/performers/:id/deactivate', requireAdmin, performers.deactivatePerformer);
router.patch('/performers/:id/reactivate', requireAdmin, performers.reactivatePerformer);
router.delete('/performers/:id', requireAdmin, performers.hardDeletePerformer);

router.get('/payments', requireAdmin, listPayments);

router.get('/settings', requireAdmin, getSettings);
router.patch('/settings', requireAdmin, updateSettings);

router.get('/sessions/active', requireAdmin, sessions.getActiveSession);
router.get('/sessions', requireAdmin, sessions.listAllSessions);
router.post('/sessions', requireAdmin, sessions.createSession);
router.patch('/sessions/:id/pause', requireAdmin, sessions.pauseSession);
router.patch('/sessions/:id/resume', requireAdmin, sessions.resumeSession);
router.patch('/sessions/:id/end', requireAdmin, sessions.endSession);

router.get('/tickets/tiers', requireAdmin, tickets.listTiers);
router.post('/tickets/tiers', requireAdmin, tickets.createTier);
router.put('/tickets/tiers/:id', requireAdmin, tickets.updateTier);
router.delete('/tickets/tiers/:id', requireAdmin, tickets.hideTier);
router.post('/tickets/scan', requireAdmin, tickets.scan);

module.exports = router;