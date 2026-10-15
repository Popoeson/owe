const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth'); // adjust to your admin auth middleware
const c = require('../controllers/adminTicketController');

router.use(requireAdmin);

router.get('/tiers', c.listTiers);
router.post('/tiers', c.createTier);
router.put('/tiers/:id', c.updateTier);
router.delete('/tiers/:id', c.hideTier);
router.post('/scan', c.scan);

module.exports = router;