const { formatMessage } = require('../utils/messages');
const User = require('../database/models/user');
const { BOOT_TIME, VERSION } = require('../config/config');

module.exports = {
  name: 'stats',
  description: 'View your stats and bot information',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userName = message.pushName || 'Scout';
    
    // Get total users and commands
    const totalUsers = await User.countDocuments();
    const totalCommands = await User.aggregate([
      { $group: { _id: null, total: { $sum: "$commandsUsed" } } }
    ]);
    
    const commandCount = totalCommands.length > 0 ? totalCommands[0].total : 0;
    
    // Calculate uptime
    const uptime = getUptime();
    
    // Create stats message
    let statsMessage = `⚔️ *LEVI'S ASSESSMENT* ⚔️\n\n`;
    
    // User stats
    statsMessage += `📊 *YOUR STATS* 📊\n`;
    statsMessage += `▸ Name: ${userName}\n`;
    statsMessage += `▸ Commands used: ${user.commandsUsed}\n`;
    statsMessage += `▸ Favorite command: ${user.favoriteCommand || 'None'}\n`;
    statsMessage += `▸ Cleaning skill: ${getCleaningRank(user.cleaningSkill)}\n\n`;
    
    // Bot stats
    statsMessage += `🤖 *BOT STATS* 🤖\n`;
    statsMessage += `▸ Version: ${VERSION}\n`;
    statsMessage += `▸ Uptime: ${uptime}\n`;
    statsMessage += `▸ Total users: ${totalUsers}\n`;
    statsMessage += `▸ Total commands executed: ${commandCount}\n\n`;
    
    // Levi's assessment
    statsMessage += `${getLeviAssessment(user.cleaningSkill)}`;
    
    await sock.sendMessage(sender, { text: formatMessage(statsMessage, userName) });
  }
};

// Helper functions
function getUptime() {
  const bootTime = new Date(BOOT_TIME);
  const now = new Date();
  const diff = now - bootTime;
  
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  
  return `${days}d ${hours}h ${minutes}m`;
}

function getCleaningRank(skill) {
  if (skill < 10) return '🧹 Novice (Would disappoint Levi)';
  if (skill < 30) return '🧹🧹 Adequate (Levi might not yell at you)';
  if (skill < 60) return '🧹🧹🧹 Proficient (Levi approves)';
  if (skill < 100) return '🧹🧹🧹🧹 Expert (Almost like Levi)';
  return '🧹🧹🧹🧹🧹 Master (Levi would be proud)';
}

function getLeviAssessment(skill) {
  if (skill < 10) {
    return '"Pathetic. You call this clean? Get back to training."';
  } else if (skill < 30) {
    return '"Not bad, but still not good enough. Keep practicing."';
  } else if (skill < 60) {
    return '"Youre improving. I might consider putting you on the cleaning squad."';
  } else if (skill < 100) {
    return '"Your cleaning skills are acceptable. Im almost impressed."';
  } else {
    return '"Youve done well. Perhaps you understand the importance of cleanliness after all."';
  }
}