const { activeSpawns } = require('../utils/cardSpawner');
const Card = require('../database/models/card');
const UserCard = require('../database/models/userCard');
const User = require('../database/models/user');
const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'catch',
  description: 'Catch a spawned anime character',
  category: 'Card Game',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userId = message.key.participant || sender.split('@')[0];
    const userName = message.pushName || 'User';
    
    // Check if in a group
    if (!sender.endsWith('@g.us')) {
      await sock.sendMessage(sender, {
        text: formatMessage("Cards can only spawn in group chats!")
      });
      return;
    }
    
    // Check if there's an active spawn in this group
    if (!activeSpawns.has(sender)) {
      await sock.sendMessage(sender, {
        text: formatMessage("There's no character to catch right now!")
      });
      return;
    }
    
    try {
      // Get spawn data
      const spawnData = activeSpawns.get(sender);
      
      // Check if expired
      if (Date.now() > spawnData.expires) {
        activeSpawns.delete(sender);
        await sock.sendMessage(sender, {
          text: formatMessage("The character got away! You were too slow.")
        });
        return;
      }
      
      // Get the card
      const card = await Card.findOne({ cardId: spawnData.cardId });
      
      if (!card) {
        await sock.sendMessage(sender, {
          text: formatMessage("Error: Card data not found.")
        });
        activeSpawns.delete(sender);
        return;
      }
      
      // Award the card to the user
      const userCard = new UserCard({
        userId,
        cardId: card.cardId,
        level: 1,
        exp: 0,
        inDeck: false,
        obtainedAt: new Date()
      });
      
      await userCard.save();
      
      // Remove active spawn
      activeSpawns.delete(sender);
      
      // Update user stats
      await User.findOneAndUpdate(
        { userId },
        { 
          $inc: { 
            cardsCaught: 1,
            currency: getRarityCurrencyReward(card.rarity)
          } 
        },
        { upsert: true }
      );
      
      // Send success message
      await sock.sendMessage(sender, {
        text: formatMessage(`${userName} caught ${card.name}! You earned ${getRarityCurrencyReward(card.rarity)} coins!`)
      });
      
    } catch (error) {
      console.error('Error catching card:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error processing your catch. Please try again.")
      });
    }
  }
};

// Helper functions
function getRarityCurrencyReward(rarity) {
  switch (rarity) {
    case 'legendary': return 1000;
    case 'epic': return 500;
    case 'rare': return 200;
    case 'uncommon': return 100;
    case 'common': return 50;
    default: return 10;
  }
}