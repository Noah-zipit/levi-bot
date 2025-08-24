// plugins/daily.js
const { formatMessage } = require('../utils/messages');
const Card = require('../database/models/card');
const UserCard = require('../database/models/userCard');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'daily',
  description: 'Claim your daily rewards',
  category: 'Economy',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    // Check if already claimed today
    const now = new Date();
    const lastClaim = user.lastDailyClaim || new Date(0);
    
    // Check if last claim was today
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const lastClaimDate = new Date(lastClaim);
    lastClaimDate.setHours(0, 0, 0, 0);
    
    if (lastClaimDate.getTime() === today.getTime()) {
      // Calculate time until next claim
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const timeLeft = tomorrow - now;
      const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      
      await sock.sendMessage(sender, {
        text: formatMessage(`You already claimed your daily reward today. Come back in ${hoursLeft}h ${minutesLeft}m.`)
      });
      return;
    }
    
    // Calculate streak
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastClaimWasYesterday = lastClaimDate.getTime() === yesterday.getTime();
    
    if (lastClaimWasYesterday) {
      user.dailyStreak = (user.dailyStreak || 0) + 1;
    } else {
      user.dailyStreak = 1;
    }
    
    // Base rewards
    let coinsReward = 100;
    let cardChance = 0.1; // 10% chance for a bonus card
    
    // Streak bonuses
    if (user.dailyStreak >= 7) {
      coinsReward += 100;
      cardChance = 0.5; // 50% chance after a week streak
    } else if (user.dailyStreak >= 3) {
      coinsReward += 50;
      cardChance = 0.25; // 25% chance after 3 days
    }
    
    // Award coins
    user.coins = (user.coins || 0) + coinsReward;
    user.lastDailyClaim = now;
    await user.save();
    
    // Prepare response message
    let rewardMsg = `🎁 **DAILY REWARD CLAIMED!** 🎁\n\n`;
    rewardMsg += `You received ${coinsReward} coins!\n`;
    rewardMsg += `Current streak: ${user.dailyStreak} day${user.dailyStreak !== 1 ? 's' : ''}\n\n`;
    
    // Bonus message for streak milestones
    if (user.dailyStreak === 7) {
      rewardMsg += `Congratulations on reaching a 7-day streak! You now get maximum daily rewards!\n\n`;
    } else if (user.dailyStreak === 3) {
      rewardMsg += `Great job on your 3-day streak! Your rewards have increased!\n\n`;
    } else if (user.dailyStreak > 1) {
      rewardMsg += `Keep the streak going for better rewards!\n\n`;
    }
    
    rewardMsg += `New balance: ${user.coins} coins`;
    
    // Check for bonus card
    if (Math.random() < cardChance) {
      try {
        // Get random card weighted toward common
        const rarityRoll = Math.random();
        let rarity;
        
        if (rarityRoll < 0.6) rarity = "common";
        else if (rarityRoll < 0.85) rarity = "uncommon";
        else if (rarityRoll < 0.95) rarity = "rare";
        else if (rarityRoll < 0.99) rarity = "epic";
        else rarity = "legendary";
        
        // Find a random card of this rarity
        const cards = await Card.find({ rarity });
        
        if (cards.length > 0) {
          const randomCard = cards[Math.floor(Math.random() * cards.length)];
          
          // Create a user card
          const userCardId = uuidv4();
          const newUserCard = new UserCard({
            userCardId,
            userId: user.userId,
            cardId: randomCard.cardId,
            level: 1,
            xp: 0,
            inDeck: false
          });
          
          await newUserCard.save();
          
          // Add to response
          rewardMsg += `\n\n🎴 **BONUS CARD!** 🎴\nYou received a ${rarity} card: ${randomCard.name}!`;
        }
      } catch (error) {
        console.error('Error giving bonus card:', error);
      }
    }
    
    await sock.sendMessage(sender, {
      text: formatMessage(rewardMsg)
    });
  }
};