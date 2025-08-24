const Trade = require('../database/models/trade');
const UserCard = require('../database/models/userCard');
const Card = require('../database/models/card');
const User = require('../database/models/user');
const { formatMessage } = require('../utils/messages');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'trade',
  description: 'Trade cards with another user',
  category: 'Social',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const senderId = message.key.participant || sender.split('@')[0];
    const senderName = message.pushName || 'Trader';
    
    // Check if in a group
    if (!sender.endsWith('@g.us')) {
      await sock.sendMessage(sender, {
        text: formatMessage("Trading can only be initiated in group chats!")
      });
      return;
    }
    
    // Check if trading partner is mentioned
    if (!message.message.extendedTextMessage || 
        !message.message.extendedTextMessage.contextInfo || 
        !message.message.extendedTextMessage.contextInfo.mentionedJid ||
        message.message.extendedTextMessage.contextInfo.mentionedJid.length === 0) {
      await sock.sendMessage(sender, {
        text: formatMessage("You need to @mention who you want to trade with! Usage: !trade @user")
      });
      return;
    }
    
    const receiverJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
    const receiverId = receiverJid.split('@')[0];
    
    // Can't trade with yourself
    if (senderId === receiverId) {
      await sock.sendMessage(sender, {
        text: formatMessage("You can't trade with yourself!")
      });
      return;
    }
    
    try {
      // Check if there's already a pending trade
      const existingTrade = await Trade.findOne({
        $or: [
          { sender: senderId, receiver: receiverId, status: 'pending' },
          { sender: receiverId, receiver: senderId, status: 'pending' }
        ]
      });
      
      if (existingTrade) {
        await sock.sendMessage(sender, {
          text: formatMessage("There's already a pending trade between you two!")
        });
        return;
      }
      
      // Create a new trade
      const tradeId = uuidv4();
      const newTrade = new Trade({
        tradeId,
        sender: senderId,
        receiver: receiverId,
        status: 'pending',
        senderCards: [],
        receiverCards: [],
        senderCurrency: 0,
        receiverCurrency: 0
      });
      
      await newTrade.save();
      
      // Send trade invitation
      let tradeMsg = `💱 *TRADE INVITATION* 💱\n\n`;
      tradeMsg += `${senderName} wants to trade cards with @${receiverId}!\n\n`;
      tradeMsg += `Use these commands to proceed:\n`;
      tradeMsg += `• !offer <cardName> - Add a card to the trade\n`;
      tradeMsg += `• !offercoin <amount> - Add coins to the trade\n`;
      tradeMsg += `• !viewtrade - See the current trade status\n`;
      tradeMsg += `• !accept - Accept the trade\n`;
      tradeMsg += `• !decline - Cancel the trade`;
      
      await sock.sendMessage(sender, {
        text: tradeMsg,
        mentions: [receiverJid]
      });
      
    } catch (error) {
      console.error('Error initiating trade:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error initiating the trade. Please try again.")
      });
    }
  }
};