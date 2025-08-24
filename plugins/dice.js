// plugins/dice.js
const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'dice',
  description: 'Roll dice against the bot',
  category: 'Gambling',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    // Default bet is 50 coins
    let betAmount = 50;
    
    // Check if user specified a bet
    if (args.length > 0 && !isNaN(args[0])) {
      betAmount = parseInt(args[0]);
    }
    
    // Validate bet amount
    if (betAmount < 10) {
      await sock.sendMessage(sender, {
        text: formatMessage("Minimum bet is 10 coins.")
      });
      return;
    }
    
    if (betAmount > (user.coins || 0)) {
      await sock.sendMessage(sender, {
        text: formatMessage(`You don't have enough coins. You have ${user.coins || 0} coins.`)
      });
      return;
    }
    
    // Roll dice (1-6)
    const userRoll = Math.floor(Math.random() * 6) + 1;
    const botRoll = Math.floor(Math.random() * 6) + 1;
    
    // Determine winner
    const userWins = userRoll > botRoll;
    const tie = userRoll === botRoll;
    
    // Update coins
    if (tie) {
      // Tie - no change
      await sock.sendMessage(sender, {
        text: formatMessage(`🎲 **DICE ROLL** 🎲\n\nYou rolled: ${userRoll}\nBot rolled: ${botRoll}\n\nIt's a tie! Your bet is returned.\nBalance: ${user.coins} coins.`)
      });
    } else if (userWins) {
      // User wins
      user.coins = (user.coins || 0) + betAmount;
      await user.save();
      
      await sock.sendMessage(sender, {
        text: formatMessage(`🎲 **DICE ROLL** 🎲\n\nYou rolled: ${userRoll}\nBot rolled: ${botRoll}\n\n🎉 You win ${betAmount} coins!\nNew balance: ${user.coins} coins.`)
      });
    } else {
      // Bot wins
      user.coins = (user.coins || 0) - betAmount;
      await user.save();
      
      await sock.sendMessage(sender, {
        text: formatMessage(`🎲 **DICE ROLL** 🎲\n\nYou rolled: ${userRoll}\nBot rolled: ${botRoll}\n\nYou lose ${betAmount} coins.\nNew balance: ${user.coins} coins.`)
      });
    }
  }
};