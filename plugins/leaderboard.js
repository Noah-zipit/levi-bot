const User = require('../database/models/user');
const UserCard = require('../database/models/userCard');
const { formatMessage } = require('../utils/messages');
const { getUserIdFromJid } = require('../utils/jidUtils');

module.exports = {
  name: 'leaderboard',
  description: 'View top collectors and battlers',
  category: 'Social',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userId = message.key.participant || sender.split('@')[0];
    
    let category = 'cards';
    if (args.length > 0) {
      const validCategories = ['cards', 'battle', 'coins', 'level'];
      
      if (validCategories.includes(args[0].toLowerCase())) {
        category = args[0].toLowerCase();
      }
    }
    
    try {
      let leaderboardText = '';
      
      switch (category) {
        case 'cards':
          leaderboardText = await getCardLeaderboard();
          break;
        case 'battle':
          leaderboardText = await getBattleLeaderboard();
          break;
        case 'coins':
          leaderboardText = await getCoinLeaderboard();
          break;
        case 'level':
          leaderboardText = await getLevelLeaderboard();
          break;
      }
      
      await sock.sendMessage(sender, { text: leaderboardText });
      
    } catch (error) {
      console.error('Error retrieving leaderboard:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error retrieving the leaderboard. Please try again.")
      });
    }
  }
};

// Helper function to get proper display name
async function getProperDisplayName(userId) {
  try {
    // Get user from database first
    const userRecord = await User.findOne({ userId: getUserIdFromJid(userId) });
    let name = userRecord ? userRecord.name : '';
    
    // If the name is the same as the ID, or empty, just use the ID with proper formatting
    if (!name || name === userId) {
      // These appear to be WhatsApp business IDs, not phone numbers
      return `@${getUserIdFromJid(userId)}`;
    }
    
    // Otherwise return the name
    return name;
  } catch (error) {
    console.error('Error getting display name:', error);
    return `@${getUserIdFromJid(userId)}`;
  }
}

// Card collection leaderboard
async function getCardLeaderboard() {
  // Aggregate user card counts
  const cardCounts = await UserCard.aggregate([
    { $group: { _id: '$userId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
  
  let leaderboardText = `🏆 *CARD COLLECTION LEADERBOARD* 🏆\n\n`;
  
  // Get rarities for each user
  for (let i = 0; i < cardCounts.length; i++) {
    const userId = cardCounts[i]._id;
    const count = cardCounts[i].count;
    
    // Get rarity counts
    const rarityCounts = await UserCard.aggregate([
      { $match: { userId } },
      { $lookup: { from: 'cards', localField: 'cardId', foreignField: 'cardId', as: 'card' } },
      { $unwind: '$card' },
      { $group: { _id: '$card.rarity', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    // Format rarity counts
    const rarityText = rarityCounts.map(r => 
      `${getRarityEmoji(r._id)}${r.count}`
    ).join(' ');
    
    // Get proper display name
    const displayName = await getProperDisplayName(userId);
    
    leaderboardText += `${i+1}. *${displayName}* - ${count} cards\n`;
    leaderboardText += `   ${rarityText}\n`;
  }
  
  if (cardCounts.length === 0) {
    leaderboardText += "No card collectors yet!\n";
  }
  
  leaderboardText += `\nUse !leaderboard [cards|battle|coins|level] to see different rankings.`;
  
  return leaderboardText;
}

// Battle wins leaderboard
async function getBattleLeaderboard() {
  // Get users with battle stats
  const battleStats = await User.find(
    { battles: { $exists: true, $gt: 0 } },
    { userId: 1, battles: 1, wins: 1 }
  ).sort({ wins: -1 }).limit(10);
  
  let leaderboardText = `⚔️ *BATTLE LEADERBOARD* ⚔️\n\n`;
  
  for (let i = 0; i < battleStats.length; i++) {
    const userId = battleStats[i].userId;
    const battles = battleStats[i].battles || 0;
    const wins = battleStats[i].wins || 0;
    
    // Calculate win rate
    const winRate = battles > 0 ? Math.round((wins / battles) * 100) : 0;
    
    // Get proper display name
    const displayName = await getProperDisplayName(userId);
    
    leaderboardText += `${i+1}. *${displayName}* - ${wins} wins\n`;
    leaderboardText += `   🏅 Win rate: ${winRate}% (${wins}/${battles})\n`;
  }
  
  if (battleStats.length === 0) {
    leaderboardText += "No battles recorded yet!\n";
  }
  
  leaderboardText += `\nUse !leaderboard [cards|battle|coins|level] to see different rankings.`;
  
  return leaderboardText;
}

// Coin leaderboard
async function getCoinLeaderboard() {
  // Get top users by currency
  const richestUsers = await User.find(
    { currency: { $exists: true, $gt: 0 } },
    { userId: 1, currency: 1 }
  ).sort({ currency: -1 }).limit(10);
  
  let leaderboardText = `💰 *WEALTH LEADERBOARD* 💰\n\n`;
  
  for (let i = 0; i < richestUsers.length; i++) {
    const userId = richestUsers[i].userId;
    const coins = richestUsers[i].currency || 0;
    
    // Get proper display name
    const displayName = await getProperDisplayName(userId);
    
    leaderboardText += `${i+1}. *${displayName}* - ${coins.toLocaleString()} coins\n`;
  }
  
  if (richestUsers.length === 0) {
    leaderboardText += "No wealthy users yet!\n";
  }
  
  leaderboardText += `\nUse !leaderboard [cards|battle|coins|level] to see different rankings.`;
  
  return leaderboardText;
}

// Card level leaderboard
async function getLevelLeaderboard() {
  // Get highest level cards
  const highLevelCards = await UserCard.aggregate([
    { $sort: { level: -1 } },
    { $limit: 20 },
    { $lookup: { from: 'cards', localField: 'cardId', foreignField: 'cardId', as: 'card' } },
    { $unwind: '$card' },
    { $project: { userId: 1, level: 1, cardName: '$card.name', rarity: '$card.rarity' } }
  ]);
  
  // Group by user and take highest card
  const userHighestCards = {};
  
  for (const card of highLevelCards) {
    if (!userHighestCards[card.userId] || userHighestCards[card.userId].level < card.level) {
      userHighestCards[card.userId] = card;
    }
  }
  
  // Convert to array and sort
  const topUsers = Object.values(userHighestCards).sort((a, b) => b.level - a.level).slice(0, 10);
  
  let leaderboardText = `⭐ *HIGHEST LEVEL CARDS* ⭐\n\n`;
  
  for (let i = 0; i < topUsers.length; i++) {
    const userId = topUsers[i].userId;
    const cardName = topUsers[i].cardName;
    const level = topUsers[i].level;
    const rarity = topUsers[i].rarity;
    
    // Get proper display name
    const displayName = await getProperDisplayName(userId);
    
    leaderboardText += `${i+1}. *${displayName}*\n`;
    leaderboardText += `   ${getRarityEmoji(rarity)} ${cardName} (Lv.${level})\n`;
  }
  
  if (topUsers.length === 0) {
    leaderboardText += "No high level cards yet!\n";
  }
  
  leaderboardText += `\nUse !leaderboard [cards|battle|coins|level] to see different rankings.`;
  
  return leaderboardText;
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