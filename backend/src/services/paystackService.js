const axios = require('axios');

const paystack = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
});

async function initializeTransaction({ email, amountKobo, reference, callbackUrl }) {
  const { data } = await paystack.post('/transaction/initialize', {
    email,
    amount: amountKobo,
    reference,
    callback_url: callbackUrl
  });
  return data.data; // { authorization_url, access_code, reference }
}

async function verifyTransaction(reference) {
  const { data } = await paystack.get(`/transaction/verify/${reference}`);
  return data.data; // { status: 'success' | 'failed' | ..., reference, amount, ... }
}

module.exports = { initializeTransaction, verifyTransaction };