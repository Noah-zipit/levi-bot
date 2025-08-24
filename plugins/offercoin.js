const Trade = require('../database/models/trade');
const User = require('../database/models/user');
const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'offercoin',
  description: 'Add coins to a trade offer',
  category: 'Social',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userId = message.key.participant || sender.split('@')[0];
    
    if (!args.length || isNaN(args[0]) || parseInt(args[0]) <= 0) {
      await sock.sendMessage(sender, {
        text: formatMessage("You need to specify a valid amount of coins! Usage: !offercoin <amount>")
      });
      return;
    }
    
    const amount = parseInt(args[0]);
    
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
      
      // Check if user has enough coins
      const userData = await User.findOne({ userId });
      
      if (!userData || userData.currency < amount) {
        await sock.sendMessage(sender, {
          text: formatMessage(`You don't have enough coins! You only have ${userData ? userData.currency : 0} coins.`)
        });
        return;
      }
      
      // Add coins to trade
      if (isSender) {
        activeTrade.senderCurrency = amount;
      } else {
        activeTrade.receiverCurrency = amount;
      }
      
      await activeTrade.save();
      
      // Notify user
      await sock.sendMessage(sender, {
        text: formatMessage(`Added ${amount} coins to the trade offer!`)
      });
      
      // Notify other person
      const otherUserId = isSender ? activeTrade.receiver : activeTrade.sender;
      const otherJid = `${otherUserId}@s.whatsapp.net`;
      
      await sock.sendMessage(otherJid, {
        text: formatMessage(`@${userId} added ${amount} coins to the trade offer!`),
        mentions: [`${userId}@s.whatsapp.net`]
      });
      
    } catch (error) {
      console.error('Error adding coins to trade:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error adding coins to the trade. Please try again.")
      });
    }
  }
};