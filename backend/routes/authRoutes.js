const router = require('express').Router();
const authController = require('../controllers/authController');
const requireAdmin = require('../middleware/requireAdmin');

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/session', requireAdmin, authController.session);

module.exports = router;