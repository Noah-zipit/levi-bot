const mongoose = require('mongoose');

const userCardSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  cardId: {
    type: String,  // Changed from ObjectId to String
    required: true,
    ref: 'Card'    // Still reference Card model
  },
  level: {
    type: Number,
    default: 1
  },
  exp: {
    type: Number,
    default: 0
  },
  nickname: String,
  inDeck: {
    type: Boolean,
    default: false
  },
  deckPosition: {
    type: Number,
    min: 0,
    max: 5
  },
  favorite: {
    type: Boolean,
    default: false
  },
  obtainedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure a user can't have duplicate cards in deck positions
userCardSchema.index({ userId: 1, deckPosition: 1 }, { unique: true, partialFilterExpression: { inDeck: true } });

module.exports = mongoose.model('UserCard', userCardSchema);