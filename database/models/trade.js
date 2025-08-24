const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  tradeId: {
    type: String,
    required: true,
    unique: true
  },
  sender: {
    type: String,
    required: true
  },
  receiver: {
    type: String,
    required: true
  },
  senderCards: [String], // Array of userCardIds
  receiverCards: [String], // Array of userCardIds
  senderCurrency: {
    type: Number,
    default: 0
  },
  receiverCurrency: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // Auto-delete after 1 hour if not completed
  }
});

module.exports = mongoose.model('Trade', tradeSchema);