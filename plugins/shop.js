const User = require('../database/models/user');
const Card = require('../database/models/card');
const UserCard = require('../database/models/userCard');
const { formatMessage } = require('../utils/messages');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'shop',
  description: 'Visit the card shop to buy packs',
  category: 'Economy',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userId = message.key.participant || sender.split('@')[0];
    
    // If there's a subcommand
    if (args.length > 0) {
      const subCommand = args[0].toLowerCase();
      
      if (subCommand === 'buy') {
        return handleBuyCommand(sock, message, args.slice(1), userId);
      }
    }
    
    // Show shop menu
    try {
      // Get user's currency
      const userData = await User.findOne({ userId });
      const currency = userData ? userData.currency : 0;
      
      // Shop items
      const shopItems = [
        { id: 'basic', name: 'Basic Pack', price: 500, description: '5 random cards (higher chance for common/uncommon)' },
        { id: 'premium', name: 'Premium Pack', price: 1500, description: '5 random cards (higher chance for rare/epic)' },
        { id: 'legendary', name: 'Legendary Pack', price: 5000, description: '5 random cards with guaranteed legendary' },
        { id: 'special', name: 'Special Edition', price: 3000, description: '3 cards from a featured anime' }
      ];
      
      // Create shop message
      let shopMessage = `🏪 *ANIME CARD SHOP* 🏪\n\n`;
      shopMessage += `Your Coins: 💰 ${currency}\n\n`;
      
      // List items
      shopMessage += `*Available Packs:*\n`;
      shopItems.forEach(item => {
        shopMessage += `• ${item.name} - 💰 ${item.price}\n`;
        shopMessage += `  ${item.description}\n`;
      });
      
      shopMessage += `\nTo purchase: !shop buy <pack name>`;
      
      await sock.sendMessage(sender, { text: shopMessage });
      
    } catch (error) {
      console.error('Error showing shop:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error accessing the shop. Please try again.")
      });
    }
  }
};

// Handle buy command
async function handleBuyCommand(sock, message, args, userId) {
  const sender = message.key.remoteJid;
  
  if (args.length === 0) {
    await sock.sendMessage(sender, {
      text: formatMessage("Please specify which pack to buy! Usage: !shop buy <pack name>")
    });
    return;
  }
  
  const packName = args.join(' ').toLowerCase();
  
  // Pack prices and probabilities
  const packs = {
    'basic': {
      price: 500,
      probabilities: {
        legendary: 0.01,
        epic: 0.05,
        rare: 0.14,
        uncommon: 0.3,
        common: 0.5
      },
      cardCount: 5
    },
    'premium': {
      price: 1500,
      probabilities: {
        legendary: 0.05,
        epic: 0.15,
        rare: 0.3,
        uncommon: 0.3,
        common: 0.2
      },
      cardCount: 5
    },
    'legendary': {
      price: 5000,
      probabilities: {
        legendary: 0.2,
        epic: 0.3,
        rare: 0.3,
        uncommon: 0.15,
        common: 0.05
      },
      cardCount: 5,
      guaranteedLegendary: true
    },
    'special': {
      price: 3000,
      probabilities: {
        legendary: 0.1,
        epic: 0.2,
        rare: 0.3,
        uncommon: 0.2,
        common: 0.2
      },
      cardCount: 3,
      featuredAnime: true
    }
  };
  
  // Find the requested pack
  let pack;
  for (const [key, value] of Object.entries(packs)) {
    if (key.includes(packName) || key === packName) {
      pack = { id: key, ...value };
      break;
    }
  }
  
  if (!pack) {
    await sock.sendMessage(sender, {
      text: formatMessage("That pack doesn't exist! Use !shop to see available packs.")
    });
    return;
  }
  
  try {
    // Check if user has enough currency
    const userData = await User.findOne({ userId });
    
    if (!userData || userData.currency < pack.price) {
      await sock.sendMessage(sender, {
        text: formatMessage(`You don't have enough coins to buy this pack! You need ${pack.price} coins.`)
      });
      return;
    }
    
    // Deduct currency
    userData.currency -= pack.price;
    await userData.save();
    
    // Generate cards
    const cards = await generatePackCards(pack, userId);
    
    // Create response message
    let responseMsg = `🎁 *PACK OPENING: ${pack.id.toUpperCase()}* 🎁\n\n`;
    responseMsg += `You received ${cards.length} new cards:\n\n`;
    
    // Show cards
    for (const card of cards) {
      const cardData = await Card.findOne({ cardId: card.cardId });
      responseMsg += `• ${getRarityEmoji(cardData.rarity)} ${cardData.name} (${cardData.anime})\n`;
    }
    
    responseMsg += `\nUse !cards to view your collection!`;
    
    await sock.sendMessage(sender, { text: responseMsg });
    
  } catch (error) {
    console.error('Error buying pack:', error);
    await sock.sendMessage(sender, {
      text: formatMessage("There was an error processing your purchase. Please try again.")
    });
  }
}

// Generate pack cards
async function generatePackCards(pack, userId) {
  const cards = [];
  const featured = pack.featuredAnime ? await getRandomFeaturedAnime() : null;
  
  // Add guaranteed legendary if applicable
  if (pack.guaranteedLegendary) {
    const legendaryCard = await getRandomCardByRarity('legendary');
    if (legendaryCard) {
      const userCard = await addCardToUser(legendaryCard, userId);
      cards.push(userCard);
    }
  }
  
  // Fill remaining slots
  const remainingSlots = pack.guaranteedLegendary ? pack.cardCount - 1 : pack.cardCount;
  
  for (let i = 0; i < remainingSlots; i++) {
    // Determine rarity based on probabilities
    const rarityRoll = Math.random();
    let rarity;
    let cumulativeProbability = 0;
    
    for (const [r, prob] of Object.entries(pack.probabilities)) {
      cumulativeProbability += prob;
      if (rarityRoll <= cumulativeProbability) {
        rarity = r;
        break;
      }
    }
    
    // Get random card of that rarity
    const card = featured 
      ? await getRandomCardByRarityAndAnime(rarity, featured)
      : await getRandomCardByRarity(rarity);
    
    if (card) {
      const userCard = await addCardToUser(card, userId);
      cards.push(userCard);
    }
  }
  
  return cards;
}

// Add card to user's collection
async function addCardToUser(card, userId) {
  const userCard = new UserCard({
    userId,
    cardId: card.cardId,
    level: 1,
    exp: 0,
    inDeck: false,
    obtainedAt: new Date()
  });
  
  await userCard.save();
  return userCard;
}

// Get random card by rarity
async function getRandomCardByRarity(rarity) {
  const cards = await Card.find({ rarity });
  if (cards.length === 0) return null;
  return cards[Math.floor(Math.random() * cards.length)];
}

// Get random card by rarity and anime
async function getRandomCardByRarityAndAnime(rarity, anime) {
  const cards = await Card.find({ rarity, anime });
  if (cards.length === 0) return await getRandomCardByRarity(rarity);
  return cards[Math.floor(Math.random() * cards.length)];
}

// Get random featured anime
async function getRandomFeaturedAnime() {
  const featuredAnimes = [
    'Attack on Titan',
    'Demon Slayer',
    'One Piece',
    'Naruto',
    'My Hero Academia',
    'Dragon Ball',
    'Jujutsu Kaisen'
  ];
  
  return featuredAnimes[Math.floor(Math.random() * featuredAnimes.length)];
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