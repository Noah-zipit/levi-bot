// server.js
const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
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
          <style>
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              flex-direction: column;
              font-family: Arial, sans-serif;
              background-color: #f0f0f0;
            }
            h1 {
              margin-bottom: 20px;
              color: #333;
            }
            .qr-container {
              border: 10px solid white;
              box-shadow: 0 0 10px rgba(0,0,0,0.2);
              margin-bottom: 20px;
            }
            p {
              color: #555;
              text-align: center;
              max-width: 600px;
              margin-bottom: 20px;
            }
            .buttons {
              display: flex;
              gap: 10px;
            }
            button {
              padding: 10px 15px;
              background-color: #4CAF50;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            }
            button:hover {
              background-color: #45a049;
            }
          </style>
        </head>
        <body>
          <h1>Scan this QR code with WhatsApp</h1>
          <div class="qr-container">
            <img src="${latestQR}" alt="WhatsApp QR Code" />
          </div>
          <p>Open WhatsApp on your phone, go to Menu > Linked Devices > Link a Device, then scan this QR code</p>
          <div class="buttons">
            <button onclick="location.reload()">Refresh QR Code</button>
            <button onclick="window.location.href='/logs'">View Logs</button>
          </div>
          <script>
            // Refresh page every 2 minutes to get a fresh QR if needed
            setTimeout(() => {
              location.reload();
            }, 120000);
          </script>
        </body>
      </html>
    `);
  } else {
    res.send(`
      <html>
        <head>
          <title>WhatsApp QR Code</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="refresh" content="10">
          <style>
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              flex-direction: column;
              font-family: Arial, sans-serif;
              background-color: #f0f0f0;
            }
            h1 {
              margin-bottom: 20px;
              color: #333;
            }
            p {
              color: #555;
              text-align: center;
            }
            .spinner {
              border: 6px solid #f3f3f3;
              border-top: 6px solid #3498db;
              border-radius: 50%;
              width: 50px;
              height: 50px;
              animation: spin 2s linear infinite;
              margin: 30px 0;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .buttons {
              margin-top: 20px;
            }
            button {
              padding: 10px 15px;
              background-color: #4CAF50;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              margin: 0 5px;
            }
            button:hover {
              background-color: #45a049;
            }
          </style>
        </head>
        <body>
          <h1>Waiting for QR Code</h1>
          <div class="spinner"></div>
          <p>No QR code available yet. The page will refresh automatically every 10 seconds.</p>
          <p>If the QR code doesn't appear after a minute, try restarting the bot.</p>
          <div class="buttons">
            <button onclick="window.location.href='/restart'">Restart Bot</button>
            <button onclick="window.location.href='/logs'">View Logs</button>
          </div>
        </body>
      </html>
    `);
  }
});

// Serve QR image directly
app.get('/qr-image', (req, res) => {
  const qrPath = path.join(__dirname, 'qr-code.png');
  if (fs.existsSync(qrPath)) {
    res.sendFile(qrPath);
  } else {
    res.status(404).send('QR code image not found');
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
          body { 
            font-family: monospace; 
            padding: 20px; 
            background-color: #f0f0f0;
          }
          h1 {
            color: #333;
            margin-bottom: 20px;
          }
          .controls {
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
          }
          button {
            padding: 8px 15px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
          button:hover {
            background-color: #45a049;
          }
          .log-container {
            background-color: #fff;
            border-radius: 4px;
            padding: 10px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          .log { 
            margin-bottom: 5px; 
            border-bottom: 1px solid #eee;
            padding: 5px 0;
          }
          .error { 
            color: #e74c3c; 
          }
          .info { 
            color: #2980b9; 
          }
        </style>
      </head>
      <body>
        <h1>Bot Logs</h1>
        <div class="controls">
          <button onclick="fetchLogs()">Refresh Logs</button>
          <button onclick="window.location.href='/qr'">View QR Code</button>
          <button onclick="window.location.href='/restart'">Restart Bot</button>
        </div>
        <div class="log-container" id="logs">
          <p>Loading logs...</p>
        </div>
        <script>
          function fetchLogs() {
            fetch('/api/logs')
              .then(response => response.json())
              .then(data => {
                const logsDiv = document.getElementById('logs');
                logsDiv.innerHTML = '';
                
                if (data.length === 0) {
                  logsDiv.innerHTML = '<p>No logs available</p>';
                  return;
                }
                
                data.forEach(log => {
                  const logEl = document.createElement('div');
                  logEl.className = log.includes('ERROR') ? 'log error' : 'log info';
                  logEl.textContent = log;
                  logsDiv.appendChild(logEl);
                });
              })
              .catch(error => {
                const logsDiv = document.getElementById('logs');
                logsDiv.innerHTML = '<p>Error loading logs: ' + error.message + '</p>';
              });
          }
          
          fetchLogs();
          // Auto-refresh logs every 5 seconds
          setInterval(fetchLogs, 5000);
        </script>
      </body>
    </html>
  `);
});

// Add restart functionality to the server
app.get('/restart', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Restart Bot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            flex-direction: column;
            font-family: Arial, sans-serif;
            background-color: #f0f0f0;
          }
          h1 {
            margin-bottom: 20px;
            color: #333;
          }
          p {
            color: #555;
            text-align: center;
            max-width: 600px;
            margin-bottom: 20px;
          }
          button {
            padding: 12px 25px;
            font-size: 16px;
            background-color: #e74c3c;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-bottom: 20px;
          }
          button:hover {
            background-color: #c0392b;
          }
          #status {
            font-weight: bold;
            min-height: 30px;
          }
        </style>
      </head>
      <body>
        <h1>Restart the Bot</h1>
        <p>Click the button below to restart the bot. This will disconnect any current session and require scanning a new QR code.</p>
        <button onclick="restartBot()">Restart Bot</button>
        <p id="status"></p>
        <script>
          function restartBot() {
            document.getElementById('status').textContent = 'Restarting...';
            fetch('/api/restart', { method: 'POST' })
              .then(response => response.json())
              .then(data => {
                document.getElementById('status').textContent = data.message;
                setTimeout(() => {
                  window.location.href = '/qr';
                }, 5000);
              })
              .catch(error => {
                document.getElementById('status').textContent = 'Error: ' + error.message;
              });
          }
        </script>
      </body>
    </html>
  `);
});

// Simple API to get recent logs
app.get('/api/logs', (req, res) => {
  res.json(recentLogs);
});

// API endpoint to trigger restart
app.post('/api/restart', (req, res) => {
  res.json({ message: 'Bot restart initiated. Redirecting to QR page in 5 seconds...' });
  
  // Log the restart
  if (global.captureLog) {
    global.captureLog('Manual restart requested via web interface');
  }
  
  // Delete auth files to force new login
  try {
    const authDir = path.join(__dirname, 'auth_info_baileys');
    if (fs.existsSync(authDir)) {
      fs.readdirSync(authDir).forEach(file => {
        try {
          fs.unlinkSync(path.join(authDir, file));
          if (global.captureLog) {
            global.captureLog(`Deleted auth file: ${file}`);
          }
        } catch (err) {
          if (global.captureLog) {
            global.captureLog(`Error deleting file ${file}: ${err.message}`);
          }
        }
      });
    }
  } catch (err) {
    if (global.captureLog) {
      global.captureLog(`Error clearing auth files: ${err.message}`);
    }
  }
  
  // Exit process - Railway will automatically restart it
  setTimeout(() => process.exit(0), 1000);
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
