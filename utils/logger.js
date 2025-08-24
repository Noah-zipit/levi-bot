const { createLogger, format, transports } = require('winston');
const { LOG_LEVEL } = require('../config/config');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'levi-bot' },
  transports: [
    // Console transport
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(
          info => `${info.timestamp} ${info.level}: ${info.message}`
        )
      )
    }),
    // File transport for errors
    new transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // File transport for all logs
    new transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// Add custom logging methods for specific scenarios
logger.connectionError = (error, reconnect) => {
  logger.error(`WhatsApp connection error: ${JSON.stringify(error)}, reconnecting: ${reconnect}`);
};

logger.connectionSuccess = () => {
  logger.info('🔥 Captain Levi is online and ready for action!');
};

logger.commandExecuted = (command, user) => {
  logger.info(`Command executed: ${command} by user ${user}`);
};

module.exports = logger;