const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    default: 'Scout'
  },
  commandsUsed: {
    type: Number,
    default: 0
  },
  favoriteCommand: {
    type: String,
    default: ''
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  cleaningSkill: {
    type: Number,
    default: 0  // Levi rates your cleaning ability
  }
}, {
  timestamps: true
});

// Method to increment commands used
userSchema.methods.incrementCommand = async function(command) {
  this.commandsUsed += 1;
  
  // Update favorite command
  if (!this.favoriteCommand) {
    this.favoriteCommand = command;
  }
  
  this.lastSeen = Date.now();
  return this.save();
};

// Find or create user
userSchema.statics.findOrCreate = async function(userId, name) {
  let user = await this.findOne({ userId });
  
  if (!user) {
    user = new this({
      userId,
      name: name || 'Scout'
    });
    await user.save();
  }
  
  return user;
};

module.exports = mongoose.model('User', userSchema);