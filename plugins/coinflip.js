// plugins/coinflip.js
const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'coinflip',
  description: 'Flip a coin and bet on heads or tails',
  category: 'Gambling',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    if (args.length < 2) {
      await sock.sendMessage(sender, {
        text: formatMessage("Usage: !coinflip <heads/tails> <bet amount>")
      });
      return;
    }
    
    // Parse choice and bet amount
    const choice = args[0].toLowerCase();
    const betAmount = parseInt(args[1]);
    
    // Validate choice
    if (choice !== 'heads' && choice !== 'tails') {
      await sock.sendMessage(sender, {
        text: formatMessage("You must choose either 'heads' or 'tails'.")
      });
      return;
    }
    
    // Validate bet amount
    if (isNaN(betAmount) || betAmount < 10) {
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
    
    // Flip the coin (slightly house edge: 49% player win chance)
    const result = Math.random() < 0.49 ? choice : (choice === 'heads' ? 'tails' : 'heads');
    const win = result === choice;
    
    // Update coins
    if (win) {
      user.coins = (user.coins || 0) + betAmount;
      await user.save();
    } else {
      user.coins = (user.coins || 0) - betAmount;
      await user.save();
    }
    
    // Result display
    const emojiResult = result === 'heads' ? '🪙' : '⚪';
    
    let resultMessage = `**COIN FLIP** ${emojiResult}\n\n`;
    resultMessage += `The coin landed on: ${result.toUpperCase()}\n`;
    resultMessage += `You chose: ${choice.toUpperCase()}\n\n`;
    
    if (win) {
      resultMessage += `🎉 You won ${betAmount} coins!\n`;
    } else {
      resultMessage += `You lost ${betAmount} coins.\n`;
    }
    
    resultMessage += `New balance: ${user.coins} coins`;
    
    await sock.sendMessage(sender, {
      text: formatMessage(resultMessage)
    });
  }
};