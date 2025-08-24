const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'ping',
  description: 'Check if the bot is responsive',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const start = new Date().getTime();
    
    // Send a message and calculate response time
    const msg = await sock.sendMessage(sender, { text: 'Measuring response time...' });
    
    const end = new Date().getTime();
    const responseTime = end - start;
    
    // Levi-style response
    let response;
    if (responseTime < 300) {
      response = `Ping: ${responseTime}ms. Fast enough for battle.`;
    } else if (responseTime < 1000) {
      response = `Ping: ${responseTime}ms. Acceptable response time.`;
    } else {
      response = `Ping: ${responseTime}ms. Tch. Too slow. The titans would have eaten you.`;
    }
    
    await sock.sendMessage(sender, { text: formatMessage(response) });
  }
};