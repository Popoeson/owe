const crypto = require('crypto');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const { initializeTransaction, verifyTransaction } = require('../services/paystackService');
const { confirmPayment } = require('../services/idempotency');

// POST /api/register/initiate
async function initiateRegistration(req, res, next) {
  try {
    const { fullName, stageName, bio, photoUrl, whatsappNumber, email } = req.body;
if (!fullName || !stageName || !bio || !photoUrl || !whatsappNumber || !email) {
  return res.status(400).json({ error: 'Missing required fields' });
}

    const settings = await Settings.getSingleton();
    const reference = `okizz_reg_${crypto.randomBytes(8).toString('hex')}`;

    const payment = await Payment.create({
      reference,
      type: 'registration',
      amount: settings.registrationFee, // never trust a client-supplied amount
      payerEmail: email,
      payerName: fullName,
      registrationData: { fullName, stageName, bio, photoUrl, whatsappNumber}
    });

    const tx = await initializeTransaction({
      email,
      amountKobo: payment.amount,
      reference,
      callbackUrl: `${process.env.FRONTEND_URL}/callback.html`
    });

    res.json({ authorizationUrl: tx.authorization_url, reference });
  } catch (err) {
    next(err);
  }
}

// POST /api/paystack/webhook
async function paystackWebhook(req, res, next) {
  try {
    const signature = req.headers['x-paystack-signature'];
    const expected = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(req.rawBody)
      .digest('hex');

    if (signature !== expected) {
      return res.status(401).send('Invalid signature');
    }

    const event = req.body;
    if (event.event === 'charge.success') {
      await confirmPayment(event.data.reference);
    }
    // Paystack failure events don't need handling — a failed/abandoned
    // Payment simply stays 'initiated' forever (BR-06).

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/:reference/status  (used by callback page auto-poll)
async function getPaymentStatus(req, res, next) {
  try {
    const payment = await Payment.findOne({ reference: req.params.reference });
    if (!payment) return res.status(404).json({ error: 'Not found' });
    res.json({ status: payment.status });
  } catch (err) {
    next(err);
  }
}

// POST /api/payments/:reference/verify  (manual "check again" fallback)
async function manualVerify(req, res, next) {
  try {
    const { reference } = req.params;
    const payment = await Payment.findOne({ reference });
    if (!payment) return res.status(404).json({ error: 'Not found' });

    if (payment.status === 'confirmed') {
      return res.json({ status: 'confirmed' });
    }

    // Not confirmed in our DB yet — ask Paystack directly as a second opinion.
    const paystackTx = await verifyTransaction(reference);
    if (paystackTx.status === 'success') {
      const result = await confirmPayment(reference);
      return res.json({ status: result.payment.status });
    }

    res.json({ status: payment.status }); // still initiated (or failed)
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/:reference — public-safe details for the confirmation page
async function getPaymentDetails(req, res, next) {
  try {
    const payment = await Payment.findOne({ reference: req.params.reference });
    if (!payment) return res.status(404).json({ error: 'Not found' });

    res.json({
      status: payment.status,
      amount: payment.amount,
      payerEmail: payment.payerEmail,
      stageName: payment.registrationData?.stageName || null,
      fullName: payment.registrationData?.fullName || null,
      whatsappNumber: payment.registrationData?.whatsappNumber || null,
      reference: payment.reference
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { initiateRegistration, paystackWebhook, getPaymentStatus, manualVerify, getPaymentDetails };