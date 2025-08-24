const { formatMessage } = require('../utils/messages');
const os = require('os');
const { VERSION, BOOT_TIME } = require('../config/config');

module.exports = {
  name: 'alive',
  description: 'Check if bot is running',
  category: 'utility',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    // Calculate uptime
    const uptime = getUptime();
    
    // Get system info
    const freeMem = (os.freemem() / (1024 * 1024 * 1024)).toFixed(2);
    const totalMem = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2);
    
    // Create alive message
    const aliveMsg = `*CAPTAIN LEVI STATUS REPORT*\n\n` +
                    `🤖 *Bot:* Levi Ackerman\n` +
                    `🔋 *Status:* Operational\n` +
                    `⏱️ *Uptime:* ${uptime}\n` +
                    `💾 *Memory:* ${freeMem}GB / ${totalMem}GB\n` +
                    `🖥️ *Platform:* ${os.platform()} ${os.arch()}\n` +
                    `📊 *Version:* ${VERSION}\n\n` +
                    `${formatMessage("I'm alive and ready to keep things clean.")}`;
    
    // Send with Levi image
    try {
      const imagePath = path.join(__dirname, '..', 'assets', 'levi.jpg');
      const image = fs.readFileSync(imagePath);
      
      await sock.sendMessage(sender, {
        image: image,
        caption: aliveMsg,
        mimetype: 'image/jpeg'
      });
    } catch (error) {
      console.error('Error sending alive image:', error);
      await sock.sendMessage(sender, { text: aliveMsg });
    }
  }
};

// Helper function to calculate uptime
function getUptime() {
  const bootTime = new Date(BOOT_TIME);
  const now = new Date();
  const diff = now - bootTime;
  
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((diff % (60 * 1000)) / 1000);
  
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}