const router = require('express').Router();
const c = require('../controllers/ticketController');

router.get('/tiers', c.listTiers);
router.post('/initiate', c.initiatePurchase);
router.get('/by-reference/:reference', c.getByReference);

module.exports = router;