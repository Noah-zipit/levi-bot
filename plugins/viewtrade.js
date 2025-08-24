const Trade = require('../database/models/trade');
const UserCard = require('../database/models/userCard');
const Card = require('../database/models/card');
const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'viewtrade',
  description: 'View your current trade offer',
  category: 'Social',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userId = message.key.participant || sender.split('@')[0];
    
    try {
      // Find active trade
      const activeTrade = await Trade.findOne({
        $or: [
          { sender: userId, status: 'pending' },
          { receiver: userId, status: 'pending' }
        ]
      });
      
      if (!activeTrade) {
        await sock.sendMessage(sender, {
          text: formatMessage("You don't have any active trades. Start a trade with !trade @user")
        });
        return;
      }
      
      // Check if user is sender or receiver
      const isSender = activeTrade.sender === userId;
      const otherUserId = isSender ? activeTrade.receiver : activeTrade.sender;
      
      // Load card details
      const senderCards = await UserCard.find({
        _id: { $in: activeTrade.senderCards }
      }).populate('cardId');
      
      const receiverCards = await UserCard.find({
        _id: { $in: activeTrade.receiverCards }
      }).populate('cardId');
      
      // Create trade view message
      let tradeMsg = `💱 *CURRENT TRADE* 💱\n\n`;
      
      // Get names
      const senderName = isSender ? 'You' : await getUsername(sock, activeTrade.sender);
      const receiverName = isSender ? await getUsername(sock, activeTrade.receiver) : 'You';
      
      // Show what each person is offering
      tradeMsg += `*${senderName} are offering:*\n`;
      if (senderCards.length > 0) {
        senderCards.forEach(card => {
          tradeMsg += `• ${getRarityEmoji(card.cardId.rarity)} ${card.cardId.name} (${card.cardId.anime})\n`;
        });
      }
      if (activeTrade.senderCurrency > 0) {
        tradeMsg += `• ${activeTrade.senderCurrency} coins\n`;
      }
      if (senderCards.length === 0 && activeTrade.senderCurrency === 0) {
        tradeMsg += `• Nothing yet\n`;
      }
      
      tradeMsg += `\n*${receiverName} are offering:*\n`;
      if (receiverCards.length > 0) {
        receiverCards.forEach(card => {
          tradeMsg += `• ${getRarityEmoji(card.cardId.rarity)} ${card.cardId.name} (${card.cardId.anime})\n`;
        });
      }
      if (activeTrade.receiverCurrency > 0) {
        tradeMsg += `• ${activeTrade.receiverCurrency} coins\n`;
      }
      if (receiverCards.length === 0 && activeTrade.receiverCurrency === 0) {
        tradeMsg += `• Nothing yet\n`;
      }
      
      tradeMsg += `\n*Commands:*\n`;
      tradeMsg += `• !offer <cardName> - Add a card to the trade\n`;
      tradeMsg += `• !offercoin <amount> - Add coins to the trade\n`;
      tradeMsg += `• !accept - Accept the trade (receiver only)\n`;
      tradeMsg += `• !decline - Cancel the trade`;
      
      await sock.sendMessage(sender, {
        text: tradeMsg
      });
      
    } catch (error) {
      console.error('Error viewing trade:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error viewing the trade. Please try again.")
      });
    }
  }
};

// Helper function to get username
async function getUsername(sock, userId) {
  try {
    const jid = `${userId}@s.whatsapp.net`;
    const [result] = await sock.onWhatsApp(jid);
    
    if (result && result.exists) {
      try {
        const user = await sock.getContact(jid);
        return user.notify || user.vname || user.name || userId;
      } catch (err) {
        return userId;
      }
    }
    
    return userId;
  } catch (error) {
    console.error('Error getting username:', error);
    return userId;
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