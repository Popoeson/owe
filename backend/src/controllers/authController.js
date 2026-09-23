const jwt = require('jsonwebtoken');
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
      sameSite: 'none', // frontend and backend are on different domains (Vercel/Render)
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  res.clearCookie('okizz_admin_token');
  res.json({ ok: true });
}

module.exports = { login, logout };