require('dotenv').config();

module.exports = {
  BOT_NAME: 'Levi Bot',
  OWNER_NUMBER: process.env.OWNER_NUMBER || '123456789',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/levibot',
  PREFIX: '!',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  VERSION: '1.0.1',
  BOOT_TIME: new Date().toISOString(),
  MAX_RECONNECT_RETRIES: 10,
  RECONNECT_INTERVAL: 5000
};