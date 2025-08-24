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

// Store recent logs
const recentLogs = [];

// Log capture function
global.captureLog = (msg) => {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp}: ${msg}`;
  recentLogs.unshift(logMessage);
  
  // Keep only the last 100 logs
  if (recentLogs.length > 100) {
    recentLogs.pop();
  }
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

// Add this endpoint to check logs
app.get('/logs', (req, res) => {
  // Simple log display for debugging
  res.send(`
    <html>
      <head>
        <title>Bot Logs</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: monospace; padding: 20px; background-color: #f0f0f0; }
          .log { margin-bottom: 5px; padding: 3px; border-bottom: 1px solid #ddd; }
          .error { color: #e74c3c; }
          .info { color: #2980b9; }
        </style>
      </head>
      <body>
        <h1>Bot Logs</h1>
        <button onclick="fetchLogs()">Refresh Logs</button>
        <div id="logs">
          <p>Loading logs...</p>
        </div>
        <script>
          function fetchLogs() {
            fetch('/api/logs')
              .then(response => response.json())
              .then(data => {
                const logsDiv = document.getElementById('logs');
                logsDiv.innerHTML = '';
                data.forEach(log => {
                  const logEl = document.createElement('div');
                  logEl.className = log.includes('ERROR') ? 'log error' : 'log info';
                  logEl.textContent = log;
                  logsDiv.appendChild(logEl);
                });
              });
          }
          
          fetchLogs();
          setInterval(fetchLogs, 5000);
        </script>
      </body>
    </html>
  `);
});

// Simple API to get recent logs
app.get('/api/logs', (req, res) => {
  res.json(recentLogs);
});

// Start the express server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Add initial log
  if (global.captureLog) {
    global.captureLog(`Server started on port ${PORT}`);
  }
});

module.exports = app;
