const express = require('express');
const router = express.Router();
const requireAdmin = require('../middleware/requireAdmin');
const { login, logout, setup, session } = require('../controllers/authController');
const { getStats } = require('../controllers/dashboardController');
const performers = require('../controllers/performerAdminController');
const { listPayments } = require('../controllers/paymentAdminController');
const { getSettings, updateSettings } = require('../controllers/settingsAdminController');

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

module.exports = router;