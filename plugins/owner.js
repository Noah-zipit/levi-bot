// plugins/owner.js
const { formatMessage } = require('../utils/messages');
const { OWNER_NUMBER } = require('../config/config');

module.exports = {
  name: 'owner',
  description: 'Display bot owner information',
  category: 'Info',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    // Create owner contact vCard
    const vcard = 'BEGIN:VCARD\n' +
                  'VERSION:3.0\n' +
                  'FN:Bot Owner\n' +  // You can customize the name
                  `TEL;type=CELL;type=VOICE;waid=${OWNER_NUMBER}:+${OWNER_NUMBER}\n` +
                  'END:VCARD';
    
    // Prepare owner info message
    const ownerInfo = `🤖 *BOT OWNER INFORMATION* 🤖\n\n` +
                      `Contact the owner for:\n` +
                      `• Bot issues or errors\n` +
                      `• Feature requests\n` +
                      `• Adding bot to new groups\n` +
                      `• Partnership opportunities\n\n` +
                      `Please be respectful of the owner's time and only contact for bot-related matters.`;
    
    // Send owner info message
    await sock.sendMessage(sender, {
      text: formatMessage(ownerInfo)
    });
    
    // Send owner contact
    await sock.sendMessage(sender, {
      contacts: {
        displayName: 'Bot Owner',
        contacts: [{ vcard }]
      }
    });
  }
};