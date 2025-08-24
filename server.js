// server.js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Store the latest QR code
let latestQR = null;

// Set the global QR code (call this from index.js)
global.setQR = (qr) => {
  latestQR = qr;
};

// Basic health check endpoint
app.get('/', (req, res) => {
  res.status(200).send({
    status: 'ok',
    message: 'Levi Bot is running',
    timestamp: new Date().toISOString()
  });
});

// Endpoint to view QR code
app.get('/qr', (req, res) => {
  if (latestQR) {
    res.send(`
      <html>
        <head>
          <title>WhatsApp QR Code</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column;">
          <h1>Scan this QR code with WhatsApp</h1>
          <img src="${latestQR}" alt="WhatsApp QR Code" />
        </body>
      </html>
    `);
  } else {
    res.send('No QR code available yet. Please wait or restart the bot.');
  }
});

// Start the express server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
