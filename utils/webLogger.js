// utils/webLogger.js
const logger = require('./logger');

// Capture original methods
const originalInfo = logger.info;
const originalError = logger.error;

// Override with versions that also capture logs for web display
logger.info = function(msg) {
  if (global.captureLog) {
    global.captureLog(`INFO: ${msg}`);
  }
  return originalInfo.apply(this, arguments);
};

logger.error = function(msg) {
  if (global.captureLog) {
    global.captureLog(`ERROR: ${msg}`);
  }
  return originalError.apply(this, arguments);
};

module.exports = logger;
