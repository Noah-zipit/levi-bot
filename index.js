const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const { connectToDatabase } = require('./database/connection');
const { loadPlugins } = require('./plugins/_handler');
const { BOT_NAME, OWNER_NUMBER, PREFIX } = require('./config/config');
const logger = require('./utils/logger');
const { formatMessage } = require('./utils/messages');
const { attemptCardSpawn } = require('./utils/cardSpawner');
const { getUserIdFromJid, isOwner } = require('./utils/jidUtils');
const User = require('./database/models/user');

// Start web server for Railway health checks
require('./server');

// Capture logs for web interface
if (logger.info && !logger.info.isPatched) {
  const originalInfo = logger.info;
  logger.info = function(msg) {
    if (global.captureLog) {
      global.captureLog(`INFO: ${msg}`);
    }
    return originalInfo.apply(this, arguments);
  };
  logger.info.isPatched = true;
}

if (logger.error && !logger.error.isPatched) {
  const originalError = logger.error;
  logger.error = function(msg) {
    if (global.captureLog) {
      global.captureLog(`ERROR: ${msg}`);
    }
    return originalError.apply(this, arguments);
  };
  logger.error.isPatched = true;
}

// Log startup attempt
logger.info("Bot starting up...");

// Reconnection management with exponential backoff
let retryCount = 0;
const maxRetries = 10;

function reconnectWithBackoff() {
  if (retryCount >= maxRetries) {
    logger.error(`Maximum retry attempts (${maxRetries}) reached. Please check your network or WhatsApp connection.`);
    process.exit(1);
  }
  
  const delay = Math.min(Math.pow(2, retryCount) * 1000, 60000); // Max 1 minute delay
  retryCount++;
  
  logger.info(`Attempting to reconnect in ${delay/1000} seconds (attempt ${retryCount}/${maxRetries})...`);
  setTimeout(() => startBot(), delay);
}

async function startBot() {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    
    // Get the latest version
    const { version } = await fetchLatestBaileysVersion();
    logger.info(`Using WA version: ${version.join('.')}`);
    
    let state;
    let saveCreds;
    
    // Check if we have a session in environment variables
    if (process.env.SESSION_DATA) {
      logger.info('Using session from environment variable');
      
      try {
        // Decode the session data
        const sessionData = Buffer.from(process.env.SESSION_DATA, 'base64').toString();
        const creds = JSON.parse(sessionData);
        
        // Create state object
        state = {
          creds,
          keys: {}
        };
        
        // Define saveCreds function that does nothing (can't save to env var)
        saveCreds = async () => {
          logger.info('Session credentials updated (not saving to env var)');
        };
        
        logger.info('Session loaded successfully from environment variable');
      } catch (e) {
        logger.error(`Failed to load session from environment: ${e.message}`);
        logger.info('Falling back to regular auth');
        const authResult = await useMultiFileAuthState('auth_info_baileys');
        state = authResult.state;
        saveCreds = authResult.saveCreds;
      }
    } else {
      logger.info('No session data in environment, using file-based auth');
      const authResult = await useMultiFileAuthState('auth_info_baileys');
      state = authResult.state;
      saveCreds = authResult.saveCreds;
    }
    
    // Create WA Socket with improved options
    const sock = makeWASocket({
      logger: P({ level: 'silent' }),
      auth: state,
      browser: ['Levi Bot', 'Chrome', '107.0.0.0'],
      version: version,
      printQRInTerminal: true,
      connectTimeoutMs: 60000,
      qrTimeout: 60000,
      defaultQueryTimeoutMs: 30000,
      retryRequestDelayMs: 1000,
      keepAliveIntervalMs: 10000
    });
    
    // Make socket globally available for other modules
    global.waSocket = sock;
    
    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);
    
    // Load plugins
    const plugins = loadPlugins(sock);
    
    // Connection event
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      logger.info(`Connection update: ${JSON.stringify({
        connection,
        hasQR: !!qr,
        hasDisconnect: !!lastDisconnect
      })}`);
      
      // Handle QR code (only needed for file-based auth without existing session)
      if (qr) {
        // Log QR received
        logger.info('New QR code received. Scan to authenticate.');
        
        // Display QR in terminal
        qrcode.generate(qr, { small: true });
        
        // Generate QR code as data URL for web display
        try {
          QRCode.toDataURL(qr, (err, dataUrl) => {
            if (err) {
              logger.error(`Error generating QR code: ${err.message}`);
              return;
            }
            
            // Make QR available on web interface
            if (global.setQR) {
              global.setQR(dataUrl);
              logger.info('QR code set for web interface');
            }
          });
        } catch (err) {
          logger.error(`Failed to generate QR data URL: ${err.message}`);
        }
      }
      
      // Handle connection updates
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        logger.error(`Connection closed due to ${JSON.stringify(lastDisconnect?.error)}, reconnecting: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          reconnectWithBackoff();
        } else {
          logger.error('Connection closed permanently. User logged out.');
          process.exit(0);
        }
      } else if (connection === 'open') {
        // Reset retry count on successful connection
        retryCount = 0;
        logger.info('Levi bot is now online!');
        
        // Send notification to owner
        try {
          await sock.sendMessage(OWNER_NUMBER + '@s.whatsapp.net', { 
            text: "Captain Levi reporting for duty. The place is filthy." 
          });
        } catch (error) {
          logger.error(`Failed to send initial message: ${error.message}`);
        }
      }
    });
    
    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages }) => {
      try {
        for (const message of messages) {
          if (!message.message || message.key.fromMe) continue;
          
          const msg = message.message.conversation || 
                      message.message.extendedTextMessage?.text || 
                      message.message.imageMessage?.caption || 
                      '';
          
          const sender = message.key.remoteJid;
          const senderId = getUserIdFromJid(message.key.participant || sender);
          const isGroup = sender.endsWith('@g.us');
          const senderName = message.pushName || 'Scout';
          
          logger.info(`Message from ${senderName} (${senderId}): ${msg}`);
          
          // Check if user is banned before processing commands
          const userRecord = await User.findOne({ userId: senderId });
          if (userRecord && userRecord.banned && !isOwner(senderId, OWNER_NUMBER)) {
            logger.info(`Skipping message from banned user: ${senderId}`);
            continue;
          }
          
          // Attempt to spawn a card (only in group chats)
          if (isGroup) {
            await attemptCardSpawn(sock, sender);
          }
          
          // Process commands through plugins
          if (msg.startsWith(PREFIX)) {
            const args = msg.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            
            if (plugins[command]) {
              try {
                await plugins[command].execute(sock, message, args);
                logger.info(`Executed command: ${command} by ${senderName} (${senderId})`);
              } catch (error) {
                logger.error(`Error executing command ${command}: ${error.message}`);
                await sock.sendMessage(sender, { 
                  text: formatMessage("Tch. Something went wrong. How disappointing.") 
                });
              }
            }
          }
        }
      } catch (error) {
        logger.error(`Error processing message: ${error.message}`);
      }
    });
    
    // Handle group participants update (joins/leaves)
    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
      try {
        // Only handle in groups
        if (!id.endsWith('@g.us')) return;
        
        const groupMetadata = await sock.groupMetadata(id);
        const groupName = groupMetadata.subject;
        
        if (action === 'add') {
          // Welcome message for new members
          for (const participant of participants) {
            const userName = getUserIdFromJid(participant);
            
            // Get user name if possible
            let displayName;
            try {
              const userInfo = await sock.getContact(participant);
              displayName = userInfo.notify || userInfo.vname || userInfo.name || userName;
            } catch (err) {
              displayName = userName;
            }
            
            const welcomeMsg = formatMessage(`Welcome to ${groupName}, ${displayName}. Keep the place clean, or you'll answer to me.`);
            
            await sock.sendMessage(id, { 
              text: welcomeMsg,
              mentions: [participant]
            });
          }
        } else if (action === 'remove') {
          // Someone left
          for (const participant of participants) {
            const userName = getUserIdFromJid(participant);
            
            // Get user name if possible
            let displayName;
            try {
              const userInfo = await sock.getContact(participant);
              displayName = userInfo.notify || userInfo.vname || userInfo.name || userName;
            } catch (err) {
              displayName = userName;
            }
            
            const goodbyeMsg = formatMessage(`${displayName} has left. One less person to clean up after.`);
            
            await sock.sendMessage(id, { text: goodbyeMsg });
          }
        }
      } catch (error) {
        logger.error(`Error handling group update: ${error.message}`);
      }
    });
    
  } catch (error) {
    logger.error(`Fatal error starting bot: ${error.message}`);
    reconnectWithBackoff();
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

// Start the bot
startBot();
