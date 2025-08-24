const Card = require('../database/models/card');
const UserCard = require('../database/models/userCard');
const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'card',
  description: 'View details of a specific card',
  category: 'Card Game',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userId = message.key.participant || sender.split('@')[0];
    
    if (!args.length) {
      await sock.sendMessage(sender, {
        text: formatMessage("You need to specify which card to view! Usage: !card <name>")
      });
      return;
    }
    
    try {
      const cardName = args.join(' ').toLowerCase();
      
      // Find user card that matches the name
      const userCards = await UserCard.find({ userId }).populate('cardId');
      
      const matchingCard = userCards.find(card => 
        card.cardId && card.cardId.name.toLowerCase().includes(cardName)
      );
      
      if (!matchingCard) {
        await sock.sendMessage(sender, {
          text: formatMessage(`You don't have a card named "${args.join(' ')}". Check your collection with !cards.`)
        });
        return;
      }
      
      const card = matchingCard.cardId;
      
      // SIMPLIFIED CARD DETAILS
      let cardDetails = `🎴 *CARD: ${card.name}* 🎴\n\n`;
      cardDetails += `*Anime:* ${card.anime}\n`;
      cardDetails += `*Rarity:* ${getRarityEmoji(card.rarity)} ${capitalize(card.rarity)}\n`;
      cardDetails += `*Level:* ${matchingCard.level}\n`;
      
      if (matchingCard.inDeck) {
        cardDetails += `*Status:* In Battle Deck\n`;
      }
      
      // Send card image with details
      await sock.sendMessage(sender, {
        image: { url: card.imageUrl },
        caption: cardDetails
      });
      
    } catch (error) {
      console.error('Error displaying card:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error retrieving card details. Please try again.")
      });
    }
  }
};

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

function capitalize(string) {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}