const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { connectToDatabase } = require('./database/connection');
const { loadPlugins } = require('./plugins/_handler');
const { BOT_NAME, OWNER_NUMBER, PREFIX } = require('./config/config');
const logger = require('./utils/logger');
const { formatMessage } = require('./utils/messages');
const { attemptCardSpawn } = require('./utils/cardSpawner');
const { getUserIdFromJid, isOwner } = require('./utils/jidUtils');
const User = require('./database/models/user');

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
    
    // Authentication state
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    // Create WA Socket with improved options
    const sock = makeWASocket({
      logger: P({ level: 'silent' }),
      auth: state,
      browser: ['Levi Bot', 'Firefox', '102.0'],
      version: version,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:102.0) Gecko/20100101 Firefox/102.0',
      connectTimeoutMs: 60000,
      qrTimeout: 60000,
      defaultQueryTimeoutMs: 30000,
      retryRequestDelayMs: 1000,
      keepAliveIntervalMs: 10000
    });
    
    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);
    
    // Load plugins
    const plugins = loadPlugins(sock);
    
    // Connection event
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Handle QR code
      if (qr) {
        // Log QR received
        logger.info('New QR code received. Scan to authenticate.');
        
        // Display QR in terminal
        qrcode.generate(qr, { small: true });
        
        // Optionally save QR as image file
        try {
          const qrPath = path.join(__dirname, 'qr-code.png');
          const qrStream = fs.createWriteStream(qrPath);
          
          require('qrcode').toFileStream(qrStream, qr, {
            type: 'png',
            width: 600,
            margin: 1
          });
          
          logger.info(`QR code also saved to: ${qrPath}`);
        } catch (err) {
          logger.error('Failed to save QR code image: ' + err.message);
        }
      }
      
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