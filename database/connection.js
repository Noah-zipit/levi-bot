const mongoose = require('mongoose');
const { MONGODB_URI } = require('../config/config');
const logger = require('../utils/logger');

let isConnected = false;
let connectionAttempts = 0;
const maxAttempts = 5;

async function connectToDatabase() {
  if (isConnected) {
    return;
  }
  
  try {
    connectionAttempts++;
    logger.info(`Connecting to MongoDB (attempt ${connectionAttempts}/${maxAttempts})...`);
    
    mongoose.set('strictQuery', false);
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
    });
    
    isConnected = true;
    connectionAttempts = 0;
    logger.info('Connected to MongoDB successfully');
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    
    if (connectionAttempts < maxAttempts) {
      // Retry with exponential backoff
      const delay = Math.min(Math.pow(2, connectionAttempts) * 1000, 30000);
      logger.info(`Retrying MongoDB connection in ${delay/1000} seconds...`);
      setTimeout(() => connectToDatabase(), delay);
    } else {
      logger.error(`Failed to connect to MongoDB after ${maxAttempts} attempts`);
      process.exit(1);
    }
  }
}

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  isConnected = false;
  logger.warn('MongoDB disconnected. Attempting to reconnect...');
  setTimeout(() => connectToDatabase(), 5000);
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  logger.error(`MongoDB connection error: ${err.message}`);
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  logger.info('MongoDB reconnected successfully');
});

module.exports = { connectToDatabase, mongoose };