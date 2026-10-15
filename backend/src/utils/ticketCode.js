const crypto = require('crypto');

// Random, unguessable, not sequential. The QR image encodes only this string.
exports.generateTicketCode = () =>
  'OKZ-' + crypto.randomBytes(12).toString('hex').toUpperCase();