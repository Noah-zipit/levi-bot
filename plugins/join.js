const { formatMessage } = require('../utils/messages');
const User = require('../database/models/user');

module.exports = {
  name: 'join',
  description: 'Join the Scout Regiment under Captain Levi',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userName = message.pushName || 'Scout';
    
    // Check if already a member
    if (user.scoutRegiment) {
      await sock.sendMessage(sender, {
        text: formatMessage(`You're already a member of the Scout Regiment, ${userName}. Did you forget? Tch.`)
      });
      return;
    }
    
    // Update user profile
    user.scoutRegiment = true;
    user.joinDate = new Date();
    user.scoutRank = 'Recruit';
    user.missions = 0;
    user.kills = 0;
    user.cleaningSkill = 5; // Starting cleaning skill
    
    await user.save();
    
    // Create welcome message
    let welcomeMsg = `*WELCOME TO THE SCOUT REGIMENT*\n\n`;
    welcomeMsg += `${formatMessage(`I don't have time for lengthy introductions, ${userName}. You're now under my command in the Scout Regiment.`)}\n\n`;
    welcomeMsg += `🔰 *Rank:* Recruit\n`;
    welcomeMsg += `🧹 *First Assignment:* Clean the headquarters\n\n`;
    welcomeMsg += `Use !stats to check your progress. And remember:\n`;
    welcomeMsg += `_"The only thing we're allowed to do is to believe that we won't regret the choice we made."_`;
    
    await sock.sendMessage(sender, { text: welcomeMsg });
  }
};