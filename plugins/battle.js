const Battle = require('../database/models/battle');
const UserCard = require('../database/models/userCard');
const Card = require('../database/models/card');
const User = require('../database/models/user');
const { formatMessage } = require('../utils/messages');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'battle',
  description: 'Challenge another user to a card battle',
  category: 'Combat',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const challengerId = message.key.participant || sender.split('@')[0];
    const challengerName = message.pushName || 'Challenger';
    
    // Check if in a group
    if (!sender.endsWith('@g.us')) {
      await sock.sendMessage(sender, {
        text: formatMessage("Battles can only be initiated in group chats!")
      });
      return;
    }
    
    // Check if opponent is mentioned
    if (!message.message.extendedTextMessage || 
        !message.message.extendedTextMessage.contextInfo || 
        !message.message.extendedTextMessage.contextInfo.mentionedJid ||
        message.message.extendedTextMessage.contextInfo.mentionedJid.length === 0) {
      await sock.sendMessage(sender, {
        text: formatMessage("You need to @mention who you want to battle! Usage: !battle @user")
      });
      return;
    }
    
    const opponentJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
    const opponentId = opponentJid.split('@')[0];
    
    // Can't battle yourself
    if (challengerId === opponentId) {
      await sock.sendMessage(sender, {
        text: formatMessage("You can't battle yourself!")
      });
      return;
    }
    
    try {
      // Check if the challenger has a deck - don't use populate, fetch cards manually
      const challengerDeckCards = await UserCard.find({ 
        userId: challengerId,
        inDeck: true 
      });
      
      if (challengerDeckCards.length === 0) {
        await sock.sendMessage(sender, {
          text: formatMessage("You don't have a battle deck! Use !deck to set up your deck first.")
        });
        return;
      }
      
      // Manually fetch card details for each deck card
      const challengerDeck = [];
      for (const userCard of challengerDeckCards) {
        const card = await Card.findOne({ cardId: userCard.cardId });
        if (card) {
          challengerDeck.push({
            userCard,
            card
          });
        }
      }
      
      // Check if there's already a pending battle
      const existingBattle = await Battle.findOne({
        $or: [
          { challenger: challengerId, opponent: opponentId, status: 'pending' },
          { challenger: opponentId, opponent: challengerId, status: 'pending' }
        ]
      });
      
      if (existingBattle) {
        await sock.sendMessage(sender, {
          text: formatMessage("There's already a pending battle between you two!")
        });
        return;
      }
      
      // Create a new battle
      const battleId = uuidv4();
      const newBattle = new Battle({
        battleId,
        challenger: challengerId,
        opponent: opponentId,
        status: 'pending',
        // Store userCard IDs instead of trying to reference the cards directly
        challengerDeck: challengerDeckCards.map(card => card._id),
        wager: args.length > 0 && !isNaN(args[0]) ? parseInt(args[0]) : 0
      });
      
      await newBattle.save();
      
      // Send challenge message
      let challengeMsg = `⚔️ *BATTLE CHALLENGE* ⚔️\n\n`;
      challengeMsg += `${challengerName} has challenged @${opponentId} to a card battle!\n\n`;
      
      if (newBattle.wager > 0) {
        challengeMsg += `*Wager:* ${newBattle.wager} coins\n\n`;
      }
      
      challengeMsg += `${challengerName}'s deck: ${challengerDeck.length} cards\n`;
      
      // Show challenger's top card
      if (challengerDeck.length > 0) {
        const topCard = challengerDeck[0];
        // Use the composite object structure
        challengeMsg += `Top card: ${getRarityEmoji(topCard.card.rarity)} ${topCard.card.name} (Lv.${topCard.userCard.level})\n\n`;
      }
      
      challengeMsg += `@${opponentId}, use !accept to accept the challenge or !decline to decline.`;
      
      await sock.sendMessage(sender, {
        text: challengeMsg,
        mentions: [opponentJid]
      });
      
    } catch (error) {
      console.error('Error initiating battle:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error initiating the battle. Please try again.")
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