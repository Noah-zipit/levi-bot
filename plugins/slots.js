// plugins/slots.js
const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'slots',
  description: 'Try your luck with the slot machine',
  category: 'Gambling',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    // Default bet amount
    let betAmount = 50;
    
    // Check if user specified a bet amount
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
    
    // Slot symbols with their probabilities and multipliers
    const symbols = [
      { symbol: '🍒', probability: 0.30, multiplier: 1 },
      { symbol: '🍋', probability: 0.25, multiplier: 1.5 },
      { symbol: '🍊', probability: 0.20, multiplier: 2 },
      { symbol: '🍇', probability: 0.15, multiplier: 3 },
      { symbol: '🔔', probability: 0.07, multiplier: 5 },
      { symbol: '💎', probability: 0.03, multiplier: 10 }
    ];
    
    // Function to get a random symbol based on probabilities
    function getRandomSymbol() {
      const rand = Math.random();
      let cumulativeProbability = 0;
      
      for (const item of symbols) {
        cumulativeProbability += item.probability;
        if (rand < cumulativeProbability) {
          return item;
        }
      }
      
      return symbols[0]; // Fallback
    }
    
    // Generate slot results
    const result = [
      getRandomSymbol(),
      getRandomSymbol(),
      getRandomSymbol()
    ];
    
    // Format slot display
    const slotsDisplay = `
╔═════╦═════╦═════╗
║  ${result[0].symbol}  ║  ${result[1].symbol}  ║  ${result[2].symbol}  ║
╚═════╩═════╩═════╝`;
    
    // Calculate winnings
    let winnings = 0;
    let outcomeMessage = "You lost!";
    
    // Check for matches
    if (result[0].symbol === result[1].symbol && result[1].symbol === result[2].symbol) {
      // Jackpot - all three match
      winnings = Math.floor(betAmount * result[0].multiplier * 3);
      outcomeMessage = `JACKPOT! All three ${result[0].symbol} match!`;
    } else if (result[0].symbol === result[1].symbol || result[1].symbol === result[2].symbol || result[0].symbol === result[2].symbol) {
      // Two matches
      let matchSymbol;
      if (result[0].symbol === result[1].symbol) matchSymbol = result[0];
      else if (result[1].symbol === result[2].symbol) matchSymbol = result[1];
      else matchSymbol = result[0];
      
      winnings = Math.floor(betAmount * matchSymbol.multiplier);
      outcomeMessage = `Two ${matchSymbol.symbol} match!`;
    }
    
    // Update user's coins
    if (winnings > 0) {
      user.coins = (user.coins || 0) + (winnings - betAmount);
      await user.save();
      
      await sock.sendMessage(sender, {
        text: formatMessage(`${slotsDisplay}\n\n${outcomeMessage}\nYou won ${winnings} coins!\nNew balance: ${user.coins} coins.`)
      });
    } else {
      user.coins = (user.coins || 0) - betAmount;
      await user.save();
      
      await sock.sendMessage(sender, {
        text: formatMessage(`${slotsDisplay}\n\n${outcomeMessage}\nYou lost ${betAmount} coins.\nNew balance: ${user.coins} coins.`)
      });
    }
  }
};