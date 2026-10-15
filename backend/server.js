require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 4000;

app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/admin/tickets', require('./routes/adminTickets'));

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});