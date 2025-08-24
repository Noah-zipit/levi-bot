// plugins/heist.js
const { formatMessage } = require('../utils/messages');

// Store active heists
const activeHeists = {};

module.exports = {
  name: 'heist',
  description: 'Organize a group heist to steal coins',
  category: 'Gambling',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userId = user.userId;
    
    // Check if in a group
    if (!sender.endsWith('@g.us')) {
      await sock.sendMessage(sender, {
        text: formatMessage("Heists can only be organized in group chats!")
      });
      return;
    }
    
    // Handle subcommands
    if (args.length > 0) {
      const subcommand = args[0].toLowerCase();
      
      if (subcommand === 'join') {
        return joinHeist(sock, message, user);
      } else if (subcommand === 'start') {
        return startHeist(sock, message, user);
      } else if (subcommand === 'info') {
        return heistInfo(sock, message);
      }
    }
    
    // Start a new heist (default behavior)
    
    // Check if there's already an active heist in this group
    if (activeHeists[sender]) {
      await sock.sendMessage(sender, {
        text: formatMessage(
          "There's already an active heist being planned in this group!\n\n" +
          "Use !heist join to join it or !heist info to see details."
        )
      });
      return;
    }
    
    // Check if user has enough coins to participate (minimum 100 coins)
    if ((user.coins || 0) < 100) {
      await sock.sendMessage(sender, {
        text: formatMessage("You need at least 100 coins to organize a heist.")
      });
      return;
    }
    
    // Create a new heist
    activeHeists[sender] = {
      organizer: userId,
      participants: [{ userId, name: user.name || userId, investment: 100 }],
      startTime: Date.now(),
      status: 'recruiting',
      expireTime: Date.now() + (5 * 60 * 1000) // 5 minutes to join
    };
    
    // Deduct initial investment
    user.coins = (user.coins || 0) - 100;
    await user.save();
    
    // Announce the heist
    await sock.sendMessage(sender, {
      text: formatMessage(
        "💰 **HEIST PLANNING** 💰\n\n" +
        `${user.name || userId} is organizing a bank heist!\n\n` +
        "Join the crew with !heist join to participate. Each member contributes 100 coins.\n\n" +
        "The more people join, the higher your chances of success and bigger the potential reward!\n\n" +
        "The heist will begin in 5 minutes or when the organizer uses !heist start.\n\n" +
        "Current participants: 1"
      ),
      mentions: [`${userId}@s.whatsapp.net`]
    });
    
    // Set a timer to start the heist automatically
    setTimeout(() => {
      if (activeHeists[sender] && activeHeists[sender].status === 'recruiting') {
        startHeist(sock, { key: { remoteJid: sender } }, { userId: activeHeists[sender].organizer });
      }
    }, 5 * 60 * 1000);
  }
};

// Join an active heist
async function joinHeist(sock, message, user) {
  const sender = message.key.remoteJid;
  const userId = user.userId;
  
  // Check if there's an active heist
  if (!activeHeists[sender] || activeHeists[sender].status !== 'recruiting') {
    await sock.sendMessage(sender, {
      text: formatMessage("There's no active heist to join in this group.")
    });
    return;
  }
  
  // Check if user is already participating
  if (activeHeists[sender].participants.some(p => p.userId === userId)) {
    await sock.sendMessage(sender, {
      text: formatMessage("You're already part of this heist!")
    });
    return;
  }
  
  // Check if user has enough coins
  if ((user.coins || 0) < 100) {
    await sock.sendMessage(sender, {
      text: formatMessage("You need 100 coins to join the heist.")
    });
    return;
  }
  
  // Deduct the investment
  user.coins = (user.coins || 0) - 100;
  await user.save();
  
  // Add user to participants
  activeHeists[sender].participants.push({
    userId,
    name: user.name || userId,
    investment: 100
  });
  
  // Announce new participant
  await sock.sendMessage(sender, {
    text: formatMessage(
      `${user.name || userId} has joined the heist!\n\n` +
      `Current participants: ${activeHeists[sender].participants.length}`
    ),
    mentions: [`${userId}@s.whatsapp.net`]
  });
}

// Start the heist
async function startHeist(sock, message, user) {
  const sender = message.key.remoteJid;
  const userId = user.userId;
  
  // Check if there's an active heist
  if (!activeHeists[sender]) {
    await sock.sendMessage(sender, {
      text: formatMessage("There's no active heist in this group.")
    });
    return;
  }
  
  // Check if user is the organizer or if it's an automatic start
  if (activeHeists[sender].organizer !== userId && user.userId) {
    await sock.sendMessage(sender, {
      text: formatMessage("Only the heist organizer can start the heist early.")
    });
    return;
  }
  
  // Update heist status
  activeHeists[sender].status = 'in_progress';
  
  // Get participant mentions
  const mentions = activeHeists[sender].participants.map(p => `${p.userId}@s.whatsapp.net`);
  
  // Announce heist start
  await sock.sendMessage(sender, {
    text: formatMessage("🚨 **THE HEIST IS STARTING!** 🚨\n\nThe crew heads to the bank..."),
    mentions
  });
  
  // Simulate heist execution (delay for suspense)
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Calculate success chance based on participants
  const participantCount = activeHeists[sender].participants.length;
  let successChance = 0.3 + (participantCount * 0.05); // Base 30% + 5% per participant, max 80%
  if (successChance > 0.8) successChance = 0.8;
  
  // Determine if heist succeeds
  const isSuccess = Math.random() < successChance;
  
  if (isSuccess) {
    // Calculate reward
    const baseReward = 150; // Base reward per person
    const totalInvestment = participantCount * 100;
    const rewardMultiplier = 1.5 + (Math.random() * 0.5); // Random multiplier between 1.5-2x
    const totalReward = Math.floor(totalInvestment * rewardMultiplier);
    const individualReward = Math.floor(totalReward / participantCount);
    
    // Create result message
    let resultMessage = "💰 **HEIST SUCCESSFUL!** 💰\n\n";
    resultMessage += `Your crew successfully broke into the bank and stole ${totalReward} coins!\n\n`;
    resultMessage += `Each participant receives ${individualReward} coins.\n\n`;
    resultMessage += "Participants:\n";
    
    // Give rewards to participants
    for (const participant of activeHeists[sender].participants) {
      try {
        // Find user in database and update coins
        const participantUser = await require('../database/models/user').findOne({ userId: participant.userId });
        if (participantUser) {
          participantUser.coins = (participantUser.coins || 0) + individualReward;
          await participantUser.save();
          resultMessage += `• ${participant.name}: +${individualReward} coins\n`;
        }
      } catch (error) {
        console.error(`Error giving heist reward to ${participant.userId}:`, error);
      }
    }
    
    // Send result
    await sock.sendMessage(sender, {
      text: formatMessage(resultMessage),
      mentions
    });
  } else {
    // Heist failed
    // Determine failure reason
    const failureReasons = [
      "The alarm was triggered and the police arrived!",
      "The safe was harder to crack than expected!",
      "One of you accidentally tripped over the laser grid!",
      "The bank manager recognized one of you!",
      "Your getaway driver panicked and left you stranded!"
    ];
    
    const reason = failureReasons[Math.floor(Math.random() * failureReasons.length)];
    
    // Create result message
    let resultMessage = "❌ **HEIST FAILED!** ❌\n\n";
    resultMessage += `${reason}\n\n`;
    resultMessage += "You all escaped, but lost your investment.\n\n";
    resultMessage += "Better luck next time!";
    
    // Send result
    await sock.sendMessage(sender, {
      text: formatMessage(resultMessage),
      mentions
    });
  }
  
  // Clean up
  delete activeHeists[sender];
}

// Show heist info
async function heistInfo(sock, message) {
  const sender = message.key.remoteJid;
  
  // Check if there's an active heist
  if (!activeHeists[sender]) {
    await sock.sendMessage(sender, {
      text: formatMessage("There's no active heist in this group.")
    });
    return;
  }
  
  const heist = activeHeists[sender];
  
  // Calculate time remaining
  const timeRemaining = Math.max(0, Math.floor((heist.expireTime - Date.now()) / 1000));
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  
  // Create info message
  let infoMessage = "💰 **HEIST DETAILS** 💰\n\n";
  infoMessage += `Organizer: ${heist.participants[0].name}\n`;
  infoMessage += `Status: ${heist.status === 'recruiting' ? 'Recruiting crew' : 'In progress'}\n`;
  infoMessage += `Participants: ${heist.participants.length}\n`;
  
  if (heist.status === 'recruiting') {
    infoMessage += `Time remaining: ${minutes}m ${seconds}s\n\n`;
  }
  
  infoMessage += "Crew members:\n";
  heist.participants.forEach((p, i) => {
    infoMessage += `${i+1}. ${p.name} (${p.investment} coins)\n`;
  });
  
  infoMessage += "\nJoin with !heist join";
  
  // Get participant mentions
  const mentions = heist.participants.map(p => `${p.userId}@s.whatsapp.net`);
  
  // Send info
  await sock.sendMessage(sender, {
    text: formatMessage(infoMessage),
    mentions
  });
}