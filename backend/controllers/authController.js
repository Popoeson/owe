const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

const COOKIE_NAME = 'okizz_admin_session';
const isProd = process.env.NODE_ENV === 'production';

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const admin = await AdminUser.findOne({ email: email.toLowerCase().trim() });
  if (!admin) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await admin.comparePassword(password);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const token = jwt.sign(
    { id: admin._id, email: admin.email },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  // No maxAge/expires set -> browser-session cookie, matches
  // "Sessions end when you close this tab." JWT itself still expires in 8h server-side.
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax'
  });

  res.json({ email: admin.email });
};

exports.logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax'
  });
  res.json({ ok: true });
};

exports.session = (req, res) => {
  // requireAdmin already validated the token by the time we get here
  res.json({ email: req.admin.email });
};