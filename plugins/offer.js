const Trade = require('../database/models/trade');
const UserCard = require('../database/models/userCard');
const Card = require('../database/models/card');
const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'offer',
  description: 'Add a card to a trade offer',
  category: 'Social',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userId = message.key.participant || sender.split('@')[0];
    
    if (!args.length) {
      await sock.sendMessage(sender, {
        text: formatMessage("You need to specify which card to offer! Usage: !offer <cardName>")
      });
      return;
    }
    
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
      
      // Find the card
      const cardName = args.join(' ').toLowerCase();
      
      // Get user's cards
      const userCards = await UserCard.find({ userId }).populate('cardId');
      
      // Find matching card
      const matchingCard = userCards.find(card => 
        card.cardId && card.cardId.name.toLowerCase().includes(cardName)
      );
      
      if (!matchingCard) {
        await sock.sendMessage(sender, {
          text: formatMessage(`You don't have a card named "${args.join(' ')}". Check your collection with !cards.`)
        });
        return;
      }
      
      // Check if card is already in the trade
      const cardList = isSender ? activeTrade.senderCards : activeTrade.receiverCards;
      
      if (cardList.includes(matchingCard._id.toString())) {
        await sock.sendMessage(sender, {
          text: formatMessage(`That card is already in the trade offer!`)
        });
        return;
      }
      
      // Check if card is in deck
      if (matchingCard.inDeck) {
        await sock.sendMessage(sender, {
          text: formatMessage(`You can't trade cards that are in your battle deck. Remove it from your deck first with !deck remove ${matchingCard.cardId.name}`)
        });
        return;
      }
      
      // Add card to trade
      if (isSender) {
        activeTrade.senderCards.push(matchingCard._id);
      } else {
        activeTrade.receiverCards.push(matchingCard._id);
      }
      
      await activeTrade.save();
      
      // Notify user
      await sock.sendMessage(sender, {
        text: formatMessage(`Added ${matchingCard.cardId.name} to the trade offer!`)
      });
      
      // Notify other person
      const otherUserId = isSender ? activeTrade.receiver : activeTrade.sender;
      const otherJid = `${otherUserId}@s.whatsapp.net`;
      
      await sock.sendMessage(otherJid, {
        text: formatMessage(`@${userId} added ${matchingCard.cardId.name} to the trade offer!`),
        mentions: [`${userId}@s.whatsapp.net`]
      });
      
    } catch (error) {
      console.error('Error adding card to trade:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error adding the card to the trade. Please try again.")
      });
    }
  }
};