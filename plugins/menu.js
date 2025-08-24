const fs = require('fs');
const path = require('path');
const { PREFIX } = require('../config/config');
const moment = require('moment');
const { BOOT_TIME } = require('../config/config');

module.exports = {
  name: 'menu',
  description: 'Shows all available commands',
  category: 'utility',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userName = message.pushName || 'Scout';
    
    // Get all command plugins
    const pluginsDir = path.join(__dirname);
    const commandFiles = fs.readdirSync(pluginsDir)
      .filter(file => file.endsWith('.js') && file !== '_handler.js');
    
    // Define categories
    const categories = {
      'Card Game': [],
      'Combat': [],
      'Cleaning': [],
      'Character': [],
      'Social': [],
      'Economy': [],
      'Utility': [],
      'Admin': [],
      'Owner': []
    };
    
    // Load all commands
    for (const file of commandFiles) {
      try {
        const command = require(path.join(pluginsDir, file));
        if (command.name && command.description) {
          // Map categories
          let category = 'Utility'; // Default category
          
          if (command.category) {
            const cat = command.category.toLowerCase();
            if (cat === 'scout' || cat === 'character') category = 'Character';
            else if (cat === 'combat') category = 'Combat';
            else if (cat === 'cleaning') category = 'Cleaning';
            else if (cat === 'social') category = 'Social';
            else if (cat === 'economy') category = 'Economy';
            else if (cat === 'utility') category = 'Utility';
            else if (cat === 'admin') category = 'Admin';
            else if (cat === 'owner') category = 'Owner';
          }
          
          // Special case for card-related commands
          if (['card', 'cards', 'catch', 'deck', 'battle'].includes(command.name)) {
            category = 'Card Game';
          }
          
          // Add to category
          categories[category].push(command.name);
        }
      } catch (error) {
        console.error(`Error loading command from ${file}:`, error);
      }
    }
    
    // Calculate uptime
    const now = moment();
    const bootTime = moment(BOOT_TIME);
    const duration = moment.duration(now.diff(bootTime));
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();
    const seconds = duration.seconds();
    
    // Create menu text
    let menuText = `*Tch. I'm Captain Levi. Keep things clean.*\n`;
    menuText += `*The usable commands are listed below.*\n`;
    
    // Add categories with commands
    Object.entries(categories).forEach(([category, commands]) => {
      if (commands.length > 0) {
        menuText += `*━━━❰ ${category} ❱━━━*\n`;
        menuText += commands.sort().join(' , ') + '\n';
      }
    });
    
    // Add footer with user info
    menuText += ` ────────────────────\n`;
    menuText += `│- ᴜꜱᴇʀ: *${userName}*\n`;
    menuText += `│- ɴᴀᴍᴇ: Levi\n`;
    menuText += `│- ᴘʀᴇꜰɪx: ${PREFIX}\n`;
    menuText += `│- Uptime: ${hours} hours, ${minutes} minutes, ${seconds} seconds\n`;
    menuText += `╰────────────────────\n\n`;
    menuText += `_"The only thing we're allowed to do is to believe that we won't regret the choice we made."_`;
    
    // Load Levi image
    try {
      const imagePath = path.join(__dirname, '..', 'assets', 'levi.jpg');
      const image = fs.readFileSync(imagePath);
      
      // Send image with caption
      await sock.sendMessage(sender, {
        image: image,
        caption: menuText,
        mimetype: 'image/jpeg'
      });
    } catch (error) {
      console.error('Failed to load menu image:', error);
      await sock.sendMessage(sender, { text: menuText });
    }
  }
};