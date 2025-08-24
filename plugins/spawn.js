const Card = require('../database/models/card');
const { attemptCardSpawn, spawnSpecificCard } = require('../utils/cardSpawner');
const { formatMessage } = require('../utils/messages');
const { OWNER_NUMBER } = require('../config/config');

// Track user spawns
const userSpawnTracking = new Map();

module.exports = {
  name: 'spawn',
  description: 'Spawn a random anime card',
  category: 'Card Game',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userId = message.key.participant || sender.split('@')[0];
    
    // Check if in a group chat
    if (!sender.endsWith('@g.us')) {
      await sock.sendMessage(sender, {
        text: formatMessage("This command can only be used in group chats where card spawning happens.")
      });
      return;
    }
    
    try {
      // If a specific card name is provided (owner only)
      if (args.length > 0) {
        // Check if user is admin/owner for specific card spawning
        if (userId !== OWNER_NUMBER) {
          await sock.sendMessage(sender, {
            text: formatMessage("Only the bot owner can spawn specific cards. Use !spawn without arguments for a random card.")
          });
          return;
        }
        
        const cardName = args.join(' ').toLowerCase();
        
        // Find card by name
        const cards = await Card.find({ 
          name: { $regex: cardName, $options: 'i' } 
        });
        
        if (!cards.length) {
          await sock.sendMessage(sender, {
            text: formatMessage(`No cards found matching "${cardName}". Check the spelling or use !spawn without arguments for a random card.`)
          });
          return;
        }
        
        // Get the first matching card
        const card = cards[0];
        
        // Spawn the specific card
        const spawned = await spawnSpecificCard(sock, sender, card);
        
        if (spawned) {
          // Send private confirmation to admin
          await sock.sendMessage(userId + '@s.whatsapp.net', {
            text: formatMessage(`Successfully spawned ${card.name} (${card.rarity}) in the group.`)
          });
        } else {
          await sock.sendMessage(sender, {
            text: formatMessage("Failed to spawn the card. There might be an active spawn already.")
          });
        }
        
        return;
      }
      
      // Random spawn - available to all users but with rate limits
      
      // Check user's spawn history
      if (!userSpawnTracking.has(userId)) {
        userSpawnTracking.set(userId, {
          count: 0,
          lastReset: Date.now()
        });
      }
      
      const userSpawnData = userSpawnTracking.get(userId);
      
      // Reset count if it's been more than 2 minutes since last reset
      if (Date.now() - userSpawnData.lastReset > 2 * 60 * 1000) {
        userSpawnData.count = 0;
        userSpawnData.lastReset = Date.now();
      }
      
      // Check if user has reached spawn limit
      if (userSpawnData.count >= 5) {
        const timeLeft = Math.ceil((2 * 60 * 1000 - (Date.now() - userSpawnData.lastReset)) / 1000);
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        await sock.sendMessage(sender, {
          text: formatMessage(`You've reached your spawn limit. Wait ${minutes}m ${seconds}s before spawning again.`)
        });
        return;
      }
      
      // Spawn a random card
      const spawned = await attemptCardSpawn(sock, sender, true); // Force spawn
      
      if (spawned) {
        // Update user's spawn count
        userSpawnData.count++;
        
        // Only send confirmation if near limit
        if (userSpawnData.count === 4) {
          await sock.sendMessage(sender, {
            text: formatMessage("Card spawned successfully. You have 1 more spawn before cooldown.")
          });
        } else if (userSpawnData.count === 5) {
          await sock.sendMessage(sender, {
            text: formatMessage("Card spawned successfully. You've reached your limit of 5 spawns. Wait 2 minutes before spawning again.")
          });
        }
      } else {
        await sock.sendMessage(sender, {
          text: formatMessage("Failed to spawn a card. There might be an active spawn already.")
        });
      }
    } catch (error) {
      console.error('Error spawning card:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error spawning the card. Please try again.")
      });
    }
  }
};

// Clean up tracking data every hour to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  userSpawnTracking.forEach((data, userId) => {
    // Remove entries older than 2 hours
    if (now - data.lastReset > 2 * 60 * 60 * 1000) {
      userSpawnTracking.delete(userId);
    }
  });
}, 60 * 60 * 1000); // Run every hour