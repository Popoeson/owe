const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const publicRoutes = require('./routes/public.routes');
const adminRoutes = require('./routes/admin.routes');
const { paystackWebhook } = require('./controllers/paymentController');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(cookieParser());

// Webhook needs the raw body for signature verification, so it's wired up
// BEFORE the JSON body parser, with its own raw capture.
app.post(
  '/api/paystack/webhook',
  express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }),
  paystackWebhook
);

app.use(express.json());

app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use(errorHandler);

module.exports = app;