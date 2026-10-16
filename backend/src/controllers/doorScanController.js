const { scanTicketCode } = require('../services/ticketScan');

// POST /api/tickets/door/check   { doorCode }  -> 200 if the code is right
exports.check = (req, res) => res.json({ ok: true });

// POST /api/tickets/door/scan   { doorCode, code }
exports.scan = async (req, res) => {
  try {
    const { status, body } = await scanTicketCode(req.body.code);
    res.status(status).json(body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ result: 'error', message: 'Scan failed. Try again.' });
  }
};