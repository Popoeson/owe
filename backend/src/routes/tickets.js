const router = require('express').Router();
const c = require('../controllers/ticketController');
const door = require('../controllers/doorScanController');
const requireDoorCode = require('../middleware/requireDoorCode');

router.get('/tiers', c.listTiers);
router.post('/initiate', c.initiatePurchase);
router.get('/by-reference/:reference', c.getByReference);
router.post('/door/check', requireDoorCode, door.check);
router.post('/door/scan', requireDoorCode, door.scan);

module.exports = router;