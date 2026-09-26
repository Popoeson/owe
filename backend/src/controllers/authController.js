const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const AdminUser = require('../models/AdminUser');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const admin = await AdminUser.findOne({ email });
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('okizz_admin_token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax', // was 'none' — no longer needed once same-origin via the Vercel rewrite
  maxAge: 7 * 24 * 60 * 60 * 1000
});
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  res.clearCookie('okizz_admin_token', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax'
  });
  res.json({ ok: true });
}

async function session(req, res) {
  // requireAdmin already validated the token by the time we get here
  res.json({ ok: true, id: req.admin.id });
}

async function setup(req, res, next) {
  try {
    const { email, password, setupKey } = req.body;

    if (!setupKey || setupKey !== process.env.ADMIN_SETUP_KEY) {
      return res.status(403).json({ error: 'Invalid setup key' });
    }

    const existingCount = await AdminUser.countDocuments();
    if (existingCount > 0) {
      return res.status(403).json({ error: 'An admin already exists — setup is locked' });
    }

    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: 'Email and an 8+ character password are required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await AdminUser.create({ email: email.toLowerCase().trim(), passwordHash });

    res.json({ ok: true, email: admin.email });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, session, setup };