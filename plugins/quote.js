const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'quote',
  description: 'Get a quote from Captain Levi',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    const quotes = [
      "The only thing we're allowed to do is to believe that we won't regret the choice we made.",
      "If you begin to regret, you'll dull your future decisions and let others make your choices for you.",
      "You're not strong. Humanity, including me, is weak.",
      "Everyone had to be drunk on somethin' to keep pushing on. Everyone was a slave to somethin'.",
      "This world is cruel, but also very beautiful.",
      "I don't know which option you should choose. I could never advise you on that...",
      "Give up on your dreams and die.",
      "Tch. Filthy.",
      "I want to put an end to that recurring nightmare, right now. There are those who would get in my way. But I'm fine playing the role of the lunatic who kills people like that. I have to be ready to rearrange some faces. Because I choose the hell of humans killing each other over the hell of being eaten.",
      "You've done well to come this far. I respect your courage and determination.",
      "My soldiers, rage! My soldiers, scream! My soldiers, fight!",
      "If it's for the sake of protecting something, I'll face any enemy.",
      "It's good to see that someone has some fight in them."
    ];
    
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    
    // Increase cleaning skill by 1 for using Levi's wisdom
    user.cleaningSkill += 1;
    await user.save();
    
    await sock.sendMessage(sender, { text: formatMessage(randomQuote) });
  }
};