// plugins/roulette.js
const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'roulette',
  description: 'Bet on roulette (color, number, etc)',
  category: 'Gambling',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    if (args.length < 2) {
      await sock.sendMessage(sender, {
        text: formatMessage(
          "🎰 **ROULETTE** 🎰\n\n" +
          "Usage: !roulette <bet type> <amount>\n\n" +
          "Bet types:\n" +
          "• red - Win 2x (18/37 chance)\n" +
          "• black - Win 2x (18/37 chance)\n" +
          "• green - Win 35x (1/37 chance)\n" +
          "• even - Win 2x (18/37 chance)\n" +
          "• odd - Win 2x (18/37 chance)\n" +
          "• high (19-36) - Win 2x (18/37 chance)\n" +
          "• low (1-18) - Win 2x (18/37 chance)\n" +
          "• number (0-36) - Win 35x (1/37 chance)\n\n" +
          "Example: !roulette red 100"
        )
      });
      return;
    }
    
    const betType = args[0].toLowerCase();
    const betAmount = parseInt(args[1]);
    
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
    
    // Spin the wheel (European roulette: 0-36)
    const result = Math.floor(Math.random() * 37);
    
    // Determine color
    let color;
    if (result === 0) {
      color = 'green';
    } else if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(result)) {
      color = 'red';
    } else {
      color = 'black';
    }
    
    // Determine other properties
    const isEven = result !== 0 && result % 2 === 0;
    const isHigh = result >= 19 && result <= 36;
    
    // Check if the bet wins
    let win = false;
    let multiplier = 0;
    
    if (betType === 'red' && color === 'red') {
      win = true;
      multiplier = 2;
    } else if (betType === 'black' && color === 'black') {
      win = true;
      multiplier = 2;
    } else if (betType === 'green' && color === 'green') {
      win = true;
      multiplier = 36;
    } else if (betType === 'even' && isEven) {
      win = true;
      multiplier = 2;
    } else if (betType === 'odd' && !isEven && result !== 0) {
      win = true;
      multiplier = 2;
    } else if (betType === 'high' && isHigh) {
      win = true;
      multiplier = 2;
    } else if (betType === 'low' && !isHigh && result !== 0) {
      win = true;
      multiplier = 2;
    } else if (!isNaN(parseInt(betType)) && parseInt(betType) === result) {
      win = true;
      multiplier = 36;
    }
    
    // Format result message
    let colorEmoji = color === 'red' ? '🔴' : (color === 'black' ? '⚫' : '🟢');
    let resultMessage = `🎰 **ROULETTE SPIN** 🎰\n\n`;
    resultMessage += `The ball landed on: ${colorEmoji} ${result}\n`;
    resultMessage += `You bet on: ${betType}\n\n`;
    
    // Calculate winnings and update balance
    if (win) {
      const winnings = betAmount * multiplier;
      user.coins = (user.coins || 0) + (winnings - betAmount);
      await user.save();
      
      resultMessage += `🎉 You won ${winnings} coins!\n`;
      resultMessage += `New balance: ${user.coins} coins`;
    } else {
      user.coins = (user.coins || 0) - betAmount;
      await user.save();
      
      resultMessage += `You lost ${betAmount} coins.\n`;
      resultMessage += `New balance: ${user.coins} coins`;
    }
    
    await sock.sendMessage(sender, {
      text: formatMessage(resultMessage)
    });
  }
};