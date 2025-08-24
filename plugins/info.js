const { formatMessage } = require('../utils/messages');
const { VERSION } = require('../config/config');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'info',
  description: 'Get information about the bot',
  category: 'utility',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    // Count commands
    const pluginsDir = path.join(__dirname);
    const commandFiles = fs.readdirSync(pluginsDir)
      .filter(file => file.endsWith('.js') && file !== '_handler.js');
    
    // Create info message
    const infoMsg = `*LEVI ACKERMAN BOT INFO*\n\n` +
                   `🤖 *Bot Name:* Levi Ackerman\n` +
                   `👤 *Character:* Captain Levi from Attack on Titan\n` +
                   `🔢 *Version:* ${VERSION}\n` +
                   `📦 *Commands:* ${commandFiles.length}\n` +
                   `🧹 *Specialty:* Cleaning and killing titans\n\n` +
                   `*Features:*\n` +
                   `• Anime card collection system\n` +
                   `• Card battles and trading\n` +
                   `• Media downloading\n` +
                   `• Sticker creation\n` +
                   `• Group management\n\n` +
                   `Use !menu to see all available commands.\n\n` +
                   `${formatMessage("Remember, the only thing we're allowed to do is to believe that we won't regret the choice we made.")}`;
    
    // Send with Levi image
    try {
      const imagePath = path.join(__dirname, '..', 'assets', 'levi.jpg');
      const image = fs.readFileSync(imagePath);
      
      await sock.sendMessage(sender, {
        image: image,
        caption: infoMsg,
        mimetype: 'image/jpeg'
      });
    } catch (error) {
      console.error('Error sending info image:', error);
      await sock.sendMessage(sender, { text: infoMsg });
    }
  }
};