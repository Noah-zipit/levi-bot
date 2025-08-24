const Battle = require('../database/models/battle');
const Trade = require('../database/models/trade');
const UserCard = require('../database/models/userCard');
const Card = require('../database/models/card');
const User = require('../database/models/user');
const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'accept',
  description: 'Accept a battle challenge or trade offer',
  category: 'Combat',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userId = message.key.participant || sender.split('@')[0];
    const userName = message.pushName || 'User';
    
    try {
      // Check for pending battle
      const pendingBattle = await Battle.findOne({
        opponent: userId,
        status: 'pending'
      });
      
      if (pendingBattle) {
        return acceptBattle(sock, sender, userId, userName, pendingBattle);
      }
      
      // Check for pending trade
      const pendingTrade = await Trade.findOne({
        $or: [
          { sender: userId, status: 'pending' },
          { receiver: userId, status: 'pending' }
        ]
      });
      
      if (pendingTrade) {
        return acceptTrade(sock, sender, userId, userName, pendingTrade);
      }
      
      // No pending requests
      await sock.sendMessage(sender, {
        text: formatMessage("You don't have any pending battle challenges or trade offers.")
      });
      
    } catch (error) {
      console.error('Error accepting request:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error processing your request. Please try again.")
      });
    }
  }
};

// Accept battle function
async function acceptBattle(sock, sender, userId, userName, battle) {
  try {
    // Check if user has a deck
    const opponentDeck = await UserCard.find({ 
      userId,
      inDeck: true 
    }).populate('cardId');
    
    if (opponentDeck.length === 0) {
      await sock.sendMessage(sender, {
        text: formatMessage("You don't have a battle deck! Set up your deck with !deck before accepting battles.")
      });
      return;
    }
    
    // Check if challenger has enough currency for wager
    if (battle.wager > 0) {
      const challengerData = await User.findOne({ userId: battle.challenger });
      const opponentData = await User.findOne({ userId });
      
      if (!challengerData || challengerData.currency < battle.wager) {
        await sock.sendMessage(sender, {
          text: formatMessage("The challenger doesn't have enough coins for the wager. Battle cancelled.")
        });
        await Battle.deleteOne({ _id: battle._id });
        return;
      }
      
      if (!opponentData || opponentData.currency < battle.wager) {
        await sock.sendMessage(sender, {
          text: formatMessage("You don't have enough coins for the wager. Battle cancelled.")
        });
        await Battle.deleteOne({ _id: battle._id });
        return;
      }
    }
    
    // Update battle status and add opponent's deck
    battle.status = 'active';
    battle.opponentDeck = opponentDeck.map(card => card._id);
    await battle.save();
    
    // Load challenger's deck data
    const challengerDeck = await UserCard.find({
      _id: { $in: battle.challengerDeck }
    }).populate('cardId');
    
    // Start the battle
    const battleResult = simulateBattle(challengerDeck, opponentDeck);
    
    // Update battle with results
    battle.turns = battleResult.turns;
    battle.winner = battleResult.winner === 'challenger' ? battle.challenger : battle.opponent;
    battle.status = 'completed';
    await battle.save();
    
    // Handle rewards
    const winnerId = battle.winner;
    const loserId = battle.winner === battle.challenger ? battle.opponent : battle.challenger;
    
    // Award XP to cards
    const winnerDeck = winnerId === battle.challenger ? challengerDeck : opponentDeck;
    const loserDeck = winnerId === battle.challenger ? opponentDeck : challengerDeck;
    
    // Award XP to winner's cards
    for (const card of winnerDeck) {
      card.exp += 25;
      
      // Level up logic
      const expNeeded = card.level * 100;
      if (card.exp >= expNeeded) {
        card.level += 1;
        card.exp -= expNeeded;
      }
      
      await card.save();
    }
    
    // Award smaller XP to loser's cards
    for (const card of loserDeck) {
      card.exp += 10;
      
      // Level up logic
      const expNeeded = card.level * 100;
      if (card.exp >= expNeeded) {
        card.level += 1;
        card.exp -= expNeeded;
      }
      
      await card.save();
    }
    
    // Handle currency rewards
    if (battle.wager > 0) {
      await User.updateOne(
        { userId: winnerId },
        { $inc: { currency: battle.wager } }
      );
      
      await User.updateOne(
        { userId: loserId },
        { $inc: { currency: -battle.wager } }
      );
    }
    
    // Create battle report
    let battleReport = `⚔️ *BATTLE RESULTS* ⚔️\n\n`;
    
    // Show winner
    const winnerName = winnerId === battle.challenger ? await getUsername(sock, battle.challenger) : userName;
    const loserName = winnerId === battle.challenger ? userName : await getUsername(sock, battle.challenger);
    
    battleReport += `🏆 *Winner: ${winnerName}*\n`;
    battleReport += `😢 Loser: ${loserName}\n\n`;
    
    // Show battle summary
    battleReport += `*Battle Summary:*\n`;
    for (let i = 0; i < Math.min(battleResult.turns.length, 5); i++) {
      const turn = battleResult.turns[i];
      const playerName = turn.player === 'challenger' ? 
                         await getUsername(sock, battle.challenger) : 
                         userName;
      
      battleReport += `• ${playerName} used ${turn.cardName} to ${turn.move}\n`;
    }
    
    if (battleResult.turns.length > 5) {
      battleReport += `• ... and ${battleResult.turns.length - 5} more turns\n`;
    }
    
    // Show rewards
    battleReport += `\n*Rewards:*\n`;
    battleReport += `• All ${winnerName}'s cards gained 25 EXP\n`;
    battleReport += `• All ${loserName}'s cards gained 10 EXP\n`;
    
    if (battle.wager > 0) {
      battleReport += `• ${winnerName} won ${battle.wager} coins\n`;
    }
    
    await sock.sendMessage(sender, {
      text: battleReport
    });
    
  } catch (error) {
    console.error('Error accepting battle:', error);
    await sock.sendMessage(sender, {
      text: formatMessage("There was an error processing the battle. Please try again.")
    });
  }
}

// Accept trade function
async function acceptTrade(sock, sender, userId, userName, trade) {
  try {
    // Make sure trade has cards from at least one side
    if (trade.senderCards.length === 0 && trade.receiverCards.length === 0 &&
        trade.senderCurrency === 0 && trade.receiverCurrency === 0) {
      await sock.sendMessage(sender, {
        text: formatMessage("This trade is empty! Add items to the trade before accepting.")
      });
      return;
    }
    
    // Check if sender is the trader or the receiver
    const isSender = trade.sender === userId;
    const otherUserId = isSender ? trade.receiver : trade.sender;
    
    // If user is sender, they initiated the trade and cannot accept it
    if (isSender) {
      await sock.sendMessage(sender, {
        text: formatMessage("You initiated this trade. The other person needs to accept it.")
      });
      return;
    }
    
    // Check if receiver has enough currency
    if (trade.receiverCurrency > 0) {
      const receiverData = await User.findOne({ userId });
      if (!receiverData || receiverData.currency < trade.receiverCurrency) {
        await sock.sendMessage(sender, {
          text: formatMessage("You don't have enough coins for this trade!")
        });
        return;
      }
    }
    
    // Check if sender has enough currency
    if (trade.senderCurrency > 0) {
      const senderData = await User.findOne({ userId: trade.sender });
      if (!senderData || senderData.currency < trade.senderCurrency) {
        await sock.sendMessage(sender, {
          text: formatMessage("The other person doesn't have enough coins for this trade!")
        });
        return;
      }
    }
    
    // Process the trade
    // 1. Transfer cards from sender to receiver
    for (const cardId of trade.senderCards) {
      await UserCard.updateOne(
        { _id: cardId },
        { 
          $set: { 
            userId: trade.receiver,
            inDeck: false,
            deckPosition: undefined
          } 
        }
      );
    }
    
    // 2. Transfer cards from receiver to sender
    for (const cardId of trade.receiverCards) {
      await UserCard.updateOne(
        { _id: cardId },
        { 
          $set: { 
            userId: trade.sender,
            inDeck: false,
            deckPosition: undefined
          } 
        }
      );
    }
    
    // 3. Transfer currency
    if (trade.senderCurrency > 0) {
      await User.updateOne(
        { userId: trade.sender },
        { $inc: { currency: -trade.senderCurrency } }
      );
      
      await User.updateOne(
        { userId: trade.receiver },
        { $inc: { currency: trade.senderCurrency } }
      );
    }
    
    if (trade.receiverCurrency > 0) {
      await User.updateOne(
        { userId: trade.receiver },
        { $inc: { currency: -trade.receiverCurrency } }
      );
      
      await User.updateOne(
        { userId: trade.sender },
        { $inc: { currency: trade.receiverCurrency } }
      );
    }
    
    // Mark trade as completed
    trade.status = 'completed';
    await trade.save();
    
    // Load card details
    const senderCards = await UserCard.find({
      _id: { $in: trade.senderCards }
    }).populate('cardId');
    
    const receiverCards = await UserCard.find({
      _id: { $in: trade.receiverCards }
    }).populate('cardId');
    
    // Create trade completion message
    let tradeMsg = `💱 *TRADE COMPLETED* 💱\n\n`;
    
    // Show what each person gave
    const senderName = await getUsername(sock, trade.sender);
    
    tradeMsg += `*${senderName} gave:*\n`;
    if (senderCards.length > 0) {
      senderCards.forEach(card => {
        tradeMsg += `• ${getRarityEmoji(card.cardId.rarity)} ${card.cardId.name}\n`;
      });
    }
    if (trade.senderCurrency > 0) {
      tradeMsg += `• ${trade.senderCurrency} coins\n`;
    }
    if (senderCards.length === 0 && trade.senderCurrency === 0) {
      tradeMsg += `• Nothing\n`;
    }
    
    tradeMsg += `\n*${userName} gave:*\n`;
    if (receiverCards.length > 0) {
      receiverCards.forEach(card => {
        tradeMsg += `• ${getRarityEmoji(card.cardId.rarity)} ${card.cardId.name}\n`;
      });
    }
    if (trade.receiverCurrency > 0) {
      tradeMsg += `• ${trade.receiverCurrency} coins\n`;
    }
    if (receiverCards.length === 0 && trade.receiverCurrency === 0) {
      tradeMsg += `• Nothing\n`;
    }
    
    tradeMsg += `\nTrade has been successfully completed!`;
    
    // Send completion message
    await sock.sendMessage(sender, {
      text: tradeMsg
    });
    
    // Notify the other person
    const otherJid = `${otherUserId}@s.whatsapp.net`;
    await sock.sendMessage(otherJid, {
      text: tradeMsg
    });
    
  } catch (error) {
    console.error('Error accepting trade:', error);
    await sock.sendMessage(sender, {
      text: formatMessage("There was an error processing the trade. Please try again.")
    });
  }
}

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

// Battle simulation function
function simulateBattle(challengerDeck, opponentDeck) {
  const turns = [];
  let challengerHP = 100;
  let opponentHP = 100;
  
  // Prepare cards with adjusted stats
  const challengerCards = challengerDeck.map(card => ({
    id: card._id,
    name: card.cardId.name,
    type: card.cardId.type,
    attack: getAdjustedStat(card.cardId.stats.attack, card.level),
    defense: getAdjustedStat(card.cardId.stats.defense, card.level),
    speed: getAdjustedStat(card.cardId.stats.speed, card.level),
    ability: card.cardId.ability
  }));
  
  const opponentCards = opponentDeck.map(card => ({
    id: card._id,
    name: card.cardId.name,
    type: card.cardId.type,
    attack: getAdjustedStat(card.cardId.stats.attack, card.level),
    defense: getAdjustedStat(card.cardId.stats.defense, card.level),
    speed: getAdjustedStat(card.cardId.stats.speed, card.level),
    ability: card.cardId.ability
  }));
  
  // Battle loop
  let turn = 0;
  const maxTurns = 20; // Prevent infinite loops
  
  while (challengerHP > 0 && opponentHP > 0 && turn < maxTurns) {
    turn++;
    
    // Decide who goes first based on average speed
    const challengerSpeed = challengerCards.reduce((sum, card) => sum + card.speed, 0) / challengerCards.length;
    const opponentSpeed = opponentCards.reduce((sum, card) => sum + card.speed, 0) / opponentCards.length;
    
    // Challenger goes first if faster or on even turns
    const challengerFirst = challengerSpeed >= opponentSpeed || turn % 2 === 0;
    
    // Execute turns
    if (challengerFirst) {
      // Challenger's turn
      executeTurn('challenger', challengerCards, opponentCards, turns, challengerHP, opponentHP);
      
      // Check if battle ended
      if (opponentHP <= 0) break;
      
      // Opponent's turn
      executeTurn('opponent', opponentCards, challengerCards, turns, opponentHP, challengerHP);
    } else {
      // Opponent's turn
      executeTurn('opponent', opponentCards, challengerCards, turns, opponentHP, challengerHP);
      
      // Check if battle ended
      if (challengerHP <= 0) break;
      
      // Challenger's turn
      executeTurn('challenger', challengerCards, opponentCards, turns, challengerHP, opponentHP);
    }
  }
  
  // Determine winner
  let winner;
  if (opponentHP <= 0) {
    winner = 'challenger';
  } else if (challengerHP <= 0) {
    winner = 'opponent';
  } else {
    // If time runs out, the one with more HP wins
    winner = challengerHP >= opponentHP ? 'challenger' : 'opponent';
  }
  
  return {
    turns,
    winner,
    challengerHP,
    opponentHP
  };
}

// Execute a single turn in battle
function executeTurn(player, playerCards, enemyCards, turns, playerHP, enemyHP) {
  // Choose a random card from player's deck
  const card = playerCards[Math.floor(Math.random() * playerCards.length)];
  
  // Choose a random enemy card as target
  const target = enemyCards[Math.floor(Math.random() * enemyCards.length)];
  
  // Choose a move based on card type
  let move, damage;
  
  switch (card.type) {
    case 'attack':
      move = 'attack';
      damage = Math.max(1, card.attack - (target.defense * 0.5));
      enemyHP -= damage;
      break;
    case 'defense':
      move = 'defend';
      // Buff own defense
      card.defense += Math.floor(card.defense * 0.1);
      damage = 0;
      break;
    case 'balance':
      if (Math.random() < 0.7) {
        move = 'attack';
        damage = Math.max(1, card.attack - (target.defense * 0.3));
        enemyHP -= damage;
      } else {
        move = 'defend';
        card.defense += Math.floor(card.defense * 0.05);
        damage = 0;
      }
      break;
    case 'support':
      if (Math.random() < 0.3) {
        move = 'heal';
        damage = -Math.floor(card.defense * 0.2); // Negative damage = healing
        playerHP = Math.min(100, playerHP - damage); // Add health (subtract negative)
      } else {
        move = 'weaken';
        damage = Math.floor(card.attack * 0.3);
        target.defense = Math.max(1, target.defense - Math.floor(target.defense * 0.1));
        enemyHP -= damage;
      }
      break;
    default:
      move = 'attack';
      damage = Math.max(1, card.attack - (target.defense * 0.5));
      enemyHP -= damage;
  }
  
  // Record the turn
  turns.push({
    player,
    cardName: card.name,
    move,
    damage,
    target: target.name,
    timestamp: new Date()
  });
  
  return { playerHP, enemyHP };
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

function getAdjustedStat(baseStat, level) {
  // Formula: Base stat increases by 5% per level
  return Math.floor(baseStat * (1 + (level - 1) * 0.05));
}