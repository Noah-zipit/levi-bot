const Battle = require('../database/models/battle');
const Trade = require('../database/models/trade');
const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'decline',
  description: 'Decline a battle challenge or trade offer',
  category: 'Combat',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userId = message.key.participant || sender.split('@')[0];
    
    try {
      // Check for pending battle
      const pendingBattle = await Battle.findOne({
        opponent: userId,
        status: 'pending'
      });
      
      if (pendingBattle) {
        // Get challenger info for notification
        const challengerId = pendingBattle.challenger;
        
        // Delete the battle
        await Battle.deleteOne({ _id: pendingBattle._id });
        
        // Notify the current user
        await sock.sendMessage(sender, {
          text: formatMessage("You have declined the battle challenge.")
        });
        
        // Notify the challenger
        const challengerJid = `${challengerId}@s.whatsapp.net`;
        await sock.sendMessage(challengerJid, {
          text: formatMessage("Your battle challenge was declined.")
        });
        
        return;
      }
      
      // Check for pending trade
      const pendingTrade = await Trade.findOne({
        $or: [
          { sender: userId, status: 'pending' },
          { receiver: userId, status: 'pending' }
        ]
      });
      
      if (pendingTrade) {
        // Get other user for notification
        const otherUserId = pendingTrade.sender === userId ? 
                          pendingTrade.receiver : pendingTrade.sender;
        
        // Update trade status
        pendingTrade.status = 'cancelled';
        await pendingTrade.save();
        
        // Notify the current user
        await sock.sendMessage(sender, {
          text: formatMessage("You have declined the trade offer.")
        });
        
        // Notify the other user
        const otherJid = `${otherUserId}@s.whatsapp.net`;
        await sock.sendMessage(otherJid, {
          text: formatMessage("Your trade offer was declined.")
        });
        
        return;
      }
      
      // No pending requests
      await sock.sendMessage(sender, {
        text: formatMessage("You don't have any pending battle challenges or trade offers to decline.")
      });
      
    } catch (error) {
      console.error('Error declining request:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error processing your request. Please try again.")
      });
    }
  }
};