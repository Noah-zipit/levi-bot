const mongoose = require('mongoose');

const battleSchema = new mongoose.Schema({
  battleId: {
    type: String,
    required: true,
    unique: true
  },
  challenger: {
    type: String,
    required: true
  },
  opponent: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'cancelled'],
    default: 'pending'
  },
  turns: [{
    player: String,
    cardUsed: String,
    move: String,
    damage: Number,
    target: String,
    timestamp: Date
  }],
  challengerDeck: [String], // Array of userCardIds
  opponentDeck: [String],   // Array of userCardIds
  challengerHP: {
    type: Number,
    default: 100
  },
  opponentHP: {
    type: Number,
    default: 100
  },
  winner: String,
  wager: {
    type: Number,
    default: 0
  },
  expReward: {
    type: Number,
    default: 50
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // Auto-delete after 24 hours if not completed
  }
});

module.exports = mongoose.model('Battle', battleSchema);