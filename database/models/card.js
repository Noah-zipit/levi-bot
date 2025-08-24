const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  cardId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  anime: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  type: {
    type: String,
    enum: ['attack', 'defense', 'balance', 'support'],
    default: 'balance'
  },
  stats: {
    attack: {
      type: Number,
      default: 50
    },
    defense: {
      type: Number,
      default: 50
    },
    speed: {
      type: Number,
      default: 50
    }
  },
  ability: {
    name: String,
    description: String,
    effect: String
  },
  spawnRate: {
    type: Number,
    default: 10 // Percentage chance of spawning
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Card', cardSchema);