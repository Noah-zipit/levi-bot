const Card = require('../database/models/card');
const UserCard = require('../database/models/userCard');
const { formatMessage } = require('../utils/messages');
const { generateCardImage } = require('../utils/cardImageGenerator');

module.exports = {
  name: 'card',
  description: 'View details of a specific card',
  category: 'Character',
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
      
      // Generate card image
      const cardImage = await generateCardImage(card, matchingCard);
      
      // Create card details message
      let cardDetails = `🎴 *CARD DETAILS: ${card.name}* 🎴\n\n`;
      
      // Add basic info
      cardDetails += `*Anime:* ${card.anime}\n`;
      cardDetails += `*Rarity:* ${getRarityEmoji(card.rarity)} ${capitalize(card.rarity)}\n`;
      cardDetails += `*Type:* ${capitalize(card.type)}\n\n`;
      
      // Add ability details
      if (card.ability && card.ability.name) {
        cardDetails += `*Ability:* ${card.ability.name}\n`;
        cardDetails += `*Effect:* ${card.ability.description || "No description available"}\n\n`;
      }
      
      // Card status
      cardDetails += `*Status:*\n`;
      cardDetails += `${matchingCard.inDeck ? '✅ In Battle Deck' : '❌ Not in Deck'}\n`;
      cardDetails += `${matchingCard.favorite ? '⭐ Favorited' : '☆ Not Favorited'}\n`;
      cardDetails += `📅 Obtained: ${matchingCard.obtainedAt.toLocaleDateString()}\n\n`;
      
      cardDetails += `Use !deck add ${card.name} to add this card to your battle deck.`;
      
      // Send card image with details
      await sock.sendMessage(sender, {
        image: cardImage,
        caption: cardDetails,
        mimetype: 'image/png'
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
  return string.charAt(0).toUpperCase() + string.slice(1);
}