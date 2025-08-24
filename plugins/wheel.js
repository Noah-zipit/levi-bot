// plugins/wheel.js
const { formatMessage } = require('../utils/messages');
const Card = require('../database/models/card');
const UserCard = require('../database/models/userCard');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'wheel',
  description: 'Spin the wheel of fortune',
  category: 'Gambling',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    // Check if user has enough coins to spin (100 coins)
    const spinCost = 100;
    
    if ((user.coins || 0) < spinCost) {
      await sock.sendMessage(sender, {
        text: formatMessage(`You need ${spinCost} coins to spin the wheel. You have ${user.coins || 0} coins.`)
      });
      return;
    }
    
    // Define wheel segments
    const wheelSegments = [
      { prize: "10 coins", chance: 20, action: async () => { return { coins: 10, message: "You won 10 coins!" }; } },
      { prize: "50 coins", chance: 15, action: async () => { return { coins: 50, message: "You won 50 coins!" }; } },
      { prize: "100 coins", chance: 10, action: async () => { return { coins: 100, message: "You won 100 coins!" }; } },
      { prize: "200 coins", chance: 5, action: async () => { return { coins: 200, message: "You won 200 coins!" }; } },
      { prize: "500 coins", chance: 2, action: async () => { return { coins: 500, message: "You won 500 coins! 🎉" }; } },
      { prize: "1000 coins", chance: 1, action: async () => { return { coins: 1000, message: "JACKPOT! You won 1000 coins! 🎉🎉🎉" }; } },
      { prize: "Common card", chance: 12, action: async () => { 
        return await giveRandomCard("common", user.userId);
      }},
      { prize: "Uncommon card", chance: 8, action: async () => { 
        return await giveRandomCard("uncommon", user.userId);
      }},
      { prize: "Rare card", chance: 4, action: async () => { 
        return await giveRandomCard("rare", user.userId);
      }},
      { prize: "Epic card", chance: 2, action: async () => { 
        return await giveRandomCard("epic", user.userId);
      }},
      { prize: "Legendary card", chance: 1, action: async () => { 
        return await giveRandomCard("legendary", user.userId);
      }},
      { prize: "Nothing", chance: 20, action: async () => { return { coins: 0, message: "Better luck next time!" }; } }
    ];
    
    // Charge the user for spinning
    user.coins = (user.coins || 0) - spinCost;
    await user.save();
    
    // Spin the wheel (weighted random selection)
    const segment = weightedRandom(wheelSegments);
    
    // Execute the prize action
    try {
      const result = await segment.action();
      
      // Update user coins if prize includes coins
      if (result.coins > 0) {
        user.coins = (user.coins || 0) + result.coins;
        await user.save();
      }
      
      // Prepare spinning animation
      const spinningWheel = [
        "🎡 Spinning...",
        "🎡 Spinning....",
        "🎡 Spinning.....",
        "🎡 Spinning......",
        "🎡 Spinning.......",
        "🎡 Spinning........"
      ];
      
      // Send initial message
      const initialMsg = await sock.sendMessage(sender, {
        text: formatMessage(spinningWheel[0])
      });
      
      // Simulate spinning animation
      for (let i = 1; i < spinningWheel.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Update message to create animation effect
        await sock.sendMessage(sender, {
          edit: initialMsg.key,
          text: formatMessage(spinningWheel[i])
        });
      }
      
      // Final result
      await new Promise(resolve => setTimeout(resolve, 500));
      
      let resultMessage = `🎡 **WHEEL OF FORTUNE** 🎡\n\n`;
      resultMessage += `You landed on: ${segment.prize}\n`;
      resultMessage += `${result.message}\n\n`;
      resultMessage += `New balance: ${user.coins} coins`;
      
      // Send final result
      await sock.sendMessage(sender, {
        edit: initialMsg.key,
        text: formatMessage(resultMessage)
      });
      
    } catch (error) {
      console.error('Error in wheel of fortune:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error spinning the wheel. Please try again.")
      });
      
      // Refund the spin cost
      user.coins = (user.coins || 0) + spinCost;
      await user.save();
    }
  }
};

// Weighted random selection
function weightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.chance, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= item.chance;
    if (random < 0) {
      return item;
    }
  }
  
  return items[0]; // Fallback
}

// Function to give a random card of specific rarity
async function giveRandomCard(rarity, userId) {
  try {
    // Find a random card of this rarity
    const cards = await Card.find({ rarity });
    
    if (cards.length === 0) {
      return { coins: 50, message: `No ${rarity} cards available. You got 50 coins instead!` };
    }
    
    const randomCard = cards[Math.floor(Math.random() * cards.length)];
    
    // Create a user card
    const userCardId = uuidv4();
    const newUserCard = new UserCard({
      userCardId,
      userId,
      cardId: randomCard.cardId,
      level: 1,
      xp: 0,
      inDeck: false
    });
    
    await newUserCard.save();
    
    // Determine emoji based on rarity
    let rarityEmoji = "🎴";
    if (rarity === "legendary") rarityEmoji = "🌟";
    else if (rarity === "epic") rarityEmoji = "💫";
    else if (rarity === "rare") rarityEmoji = "✨";
    else if (rarity === "uncommon") rarityEmoji = "⚡";
    else rarityEmoji = "🔹";
    
    return { 
      coins: 0, 
      message: `${rarityEmoji} You won a ${rarity} card: ${randomCard.name}!` 
    };
  } catch (error) {
    console.error('Error giving random card:', error);
    return { coins: 50, message: `Error giving card. You got 50 coins instead!` };
  }
}