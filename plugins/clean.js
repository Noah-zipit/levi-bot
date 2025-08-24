const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'clean',
  description: 'Get cleaning advice from Captain Levi',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    const cleaningTips = [
      "The key to cleaning is to eliminate all the dirt. Not just some of it.",
      "If you're going to clean, clean properly. Anything less is unacceptable.",
      "The only way to clean effectively is to be thorough and methodical.",
      "I expect you to clean until you can eat off those floors.",
      "Start from the top and work your way down. Dust before you sweep.",
      "Clean your living space like you'd clean your blades. Thoroughly.",
      "When dusting, use a damp cloth. A dry one just spreads the filth around.",
      "Clean the corners. That's where the dirt hides from the weak.",
      "Don't forget to clean under your furniture. Filth has no place anywhere.",
      "Scrub until your arms hurt, then scrub some more.",
      "A clean environment leads to a clear mind. Remember that.",
      "Change your cleaning water when it gets dirty. Otherwise, you're just spreading filth.",
      "Cleaning is not just about appearance. It's about discipline and respect."
    ];
    
    const randomTip = cleaningTips[Math.floor(Math.random() * cleaningTips.length)];
    
    // Increase cleaning skill by 2 for asking about cleaning
    user.cleaningSkill += 2;
    await user.save();
    
    await sock.sendMessage(sender, { text: formatMessage(randomTip) });
  }
};