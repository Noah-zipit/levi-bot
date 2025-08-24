const Card = require('../database/models/card');
const UserCard = require('../database/models/userCard');
const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'deck',
  description: 'Manage your battle deck',
  category: 'Combat',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userId = message.key.participant || sender.split('@')[0];
    
    if (!args.length) {
      // Show current deck
      return viewDeck(sock, sender, userId);
    }
    
    const command = args[0].toLowerCase();
    
    switch (command) {
      case 'add':
        return addToDeck(sock, sender, userId, args.slice(1).join(' '));
      case 'remove':
        return removeFromDeck(sock, sender, userId, args.slice(1).join(' '));
      case 'clear':
        return clearDeck(sock, sender, userId);
      default:
        await sock.sendMessage(sender, {
          text: formatMessage(`Unknown deck command: ${command}. Available commands: add, remove, clear`)
        });
    }
  }
};

// Helper function to view deck
async function viewDeck(sock, sender, userId) {
  try {
    // Get user's deck
    const userDeck = await UserCard.find({ 
      userId, 
      inDeck: true 
    }).sort({ deckPosition: 1 });
    
    if (userDeck.length === 0) {
      await sock.sendMessage(sender, {
        text: formatMessage("You don't have any cards in your battle deck yet! Use !deck add <name> to add cards.")
      });
      return;
    }
    
    // Get card details for each user card
    const deckWithDetails = [];
    for (const userCard of userDeck) {
      const card = await Card.findOne({ cardId: userCard.cardId });
      if (card) {
        deckWithDetails.push({
          userCard,
          card
        });
      }
    }
    
    // Create deck message
    let deckMsg = `⚔️ *YOUR BATTLE DECK* ⚔️\n\n`;
    
    // Add brief text summary
    deckWithDetails.forEach((item, index) => {
      const position = item.userCard.deckPosition !== undefined ? item.userCard.deckPosition : index;
      deckMsg += `${position + 1}. ${getRarityEmoji(item.card.rarity)} ${item.card.name} (Lv.${item.userCard.level})\n`;
    });
    
    deckMsg += `\nTotal Cards: ${deckWithDetails.length}/6\n\n`;
    deckMsg += `Use !deck add <name> to add more cards to your deck.`;
    
    await sock.sendMessage(sender, { text: deckMsg });
    
  } catch (error) {
    console.error('Error viewing deck:', error);
    await sock.sendMessage(sender, {
      text: formatMessage("There was an error retrieving your deck. Please try again.")
    });
  }
}

// Helper function to add card to deck
async function addToDeck(sock, sender, userId, cardName) {
  if (!cardName) {
    await sock.sendMessage(sender, {
      text: formatMessage("You need to specify which card to add! Usage: !deck add <name>")
    });
    return;
  }
  
  try {
    // First get all user cards
    const userCards = await UserCard.find({ userId });
    
    // Then get card details to find matching card name
    const matchingCards = [];
    for (const userCard of userCards) {
      const card = await Card.findOne({ cardId: userCard.cardId });
      if (card && card.name.toLowerCase().includes(cardName.toLowerCase())) {
        matchingCards.push({
          userCard,
          card
        });
      }
    }
    
    if (matchingCards.length === 0) {
      await sock.sendMessage(sender, {
        text: formatMessage(`You don't have a card named "${cardName}". Check your collection with !cards.`)
      });
      return;
    }
    
    // Use the first matching card
    const matchingCard = matchingCards[0];
    
    // Check if card is already in deck
    if (matchingCard.userCard.inDeck) {
      await sock.sendMessage(sender, {
        text: formatMessage(`${matchingCard.card.name} is already in your deck!`)
      });
      return;
    }
    
    // Check deck size
    const deckSize = await UserCard.countDocuments({ userId, inDeck: true });
    
    if (deckSize >= 6) {
      await sock.sendMessage(sender, {
        text: formatMessage("Your deck is already full! Remove a card first with !deck remove <name>.")
      });
      return;
    }
    
    // Add to deck
    matchingCard.userCard.inDeck = true;
    matchingCard.userCard.deckPosition = deckSize;
    await matchingCard.userCard.save();
    
    await sock.sendMessage(sender, {
      text: formatMessage(`Added ${matchingCard.card.name} to your battle deck!`)
    });
    
  } catch (error) {
    console.error('Error adding to deck:', error);
    await sock.sendMessage(sender, {
      text: formatMessage("There was an error adding the card to your deck. Please try again.")
    });
  }
}

// Helper function to remove card from deck
async function removeFromDeck(sock, sender, userId, cardName) {
  if (!cardName) {
    await sock.sendMessage(sender, {
      text: formatMessage("You need to specify which card to remove! Usage: !deck remove <name>")
    });
    return;
  }
  
  try {
    // Get deck cards
    const userDeck = await UserCard.find({ userId, inDeck: true });
    
    // Find matching card in deck
    const matchingCards = [];
    for (const userCard of userDeck) {
      const card = await Card.findOne({ cardId: userCard.cardId });
      if (card && card.name.toLowerCase().includes(cardName.toLowerCase())) {
        matchingCards.push({
          userCard,
          card
        });
      }
    }
    
    if (matchingCards.length === 0) {
      await sock.sendMessage(sender, {
        text: formatMessage(`You don't have a card named "${cardName}" in your deck.`)
      });
      return;
    }
    
    // Use the first matching card
    const matchingCard = matchingCards[0];
    
    // Get position to rearrange other cards
    const position = matchingCard.userCard.deckPosition;
    
    // Remove from deck
    matchingCard.userCard.inDeck = false;
    matchingCard.userCard.deckPosition = undefined;
    await matchingCard.userCard.save();
    
    // Rearrange other cards
    for (const deckCard of userDeck) {
      if (deckCard.deckPosition > position) {
        deckCard.deckPosition -= 1;
        await deckCard.save();
      }
    }
    
    await sock.sendMessage(sender, {
      text: formatMessage(`Removed ${matchingCard.card.name} from your battle deck!`)
    });
    
  } catch (error) {
    console.error('Error removing from deck:', error);
    await sock.sendMessage(sender, {
      text: formatMessage("There was an error removing the card from your deck. Please try again.")
    });
  }
}

// Helper function to clear deck
async function clearDeck(sock, sender, userId) {
  try {
    // Remove all cards from deck
    await UserCard.updateMany(
      { userId, inDeck: true },
      { $set: { inDeck: false, deckPosition: undefined } }
    );
    
    await sock.sendMessage(sender, {
      text: formatMessage("Your battle deck has been cleared!")
    });
    
  } catch (error) {
    console.error('Error clearing deck:', error);
    await sock.sendMessage(sender, {
      text: formatMessage("There was an error clearing your deck. Please try again.")
    });
  }
}

// Helper functions
function getRarityEmoji(rarity) {
  switch (rarity) {
    case 'legendary': return '🌟';
    case 'epic': return '💫';
    case 'rare': return '✨';
    case 'uncommon': return '⚡';
    case 'common': return '🔹';
    default: return '🎴';
  }
}