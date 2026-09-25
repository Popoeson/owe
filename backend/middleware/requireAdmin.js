const jwt = require('jsonwebtoken');

module.exports = function requireAdmin(req, res, next) {
  const token = req.cookies?.okizz_admin_session;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = { id: payload.id, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session invalid or expired' });
  }
};