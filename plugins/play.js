const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { formatMessage } = require('../utils/messages');
const axios = require('axios');

module.exports = {
  name: 'play',
  description: 'Search and download YouTube videos/audio',
  category: 'utility',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    if (!args.length) {
      await sock.sendMessage(sender, {
        text: formatMessage("Please provide a search term. Usage: !play <song/video name>")
      });
      return;
    }
    
    const searchTerm = args.join(' ');
    
    try {
      // Send initial message
      await sock.sendMessage(sender, {
        text: formatMessage(`Searching for "${searchTerm}"... This might take a moment.`)
      });
      
      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Get video info using yt-dlp
      const randomId = Math.floor(Math.random() * 10000);
      const infoJsonPath = path.join(tempDir, `info_${randomId}.json`);
      
      try {
        // Get video info
        execSync(`yt-dlp --dump-json "ytsearch1:${searchTerm}" > "${infoJsonPath}"`, {
          stdio: 'pipe'
        });
        
        // Read info JSON
        const videoInfo = JSON.parse(fs.readFileSync(infoJsonPath, 'utf8'));
        
        // Clean up info file
        fs.unlinkSync(infoJsonPath);
        
        // Format duration
        const duration = formatDuration(videoInfo.duration);
        
        // Store video info for later download
        global.pendingDownloads = global.pendingDownloads || {};
        global.pendingDownloads[sender] = {
          videoId: videoInfo.id,
          title: videoInfo.title,
          timestamp: Date.now(),
          expires: Date.now() + (5 * 60 * 1000) // Expires in 5 minutes
        };
        
        // Set expiry timeout
        setTimeout(() => {
          if (global.pendingDownloads && global.pendingDownloads[sender]) {
            delete global.pendingDownloads[sender];
          }
        }, 5 * 60 * 1000);
        
        // Get thumbnail
        let thumbnailBuffer;
        try {
          const response = await axios.get(videoInfo.thumbnail, { responseType: 'arraybuffer' });
          thumbnailBuffer = Buffer.from(response.data);
        } catch (error) {
          console.error('Error getting thumbnail:', error);
        }
        
        // Send result with options
        const resultMessage = `🎵 *Found:* ${videoInfo.title}\n` +
                             `👤 *Channel:* ${videoInfo.channel}\n` +
                             `⏱️ *Duration:* ${duration}\n` +
                             `👁️ *Views:* ${videoInfo.view_count.toLocaleString()}\n\n` +
                             `Reply with *!audio* to download audio only\n` +
                             `Reply with *!video* to download video`;
        
        if (thumbnailBuffer) {
          // Send thumbnail with message
          await sock.sendMessage(sender, {
            image: thumbnailBuffer,
            caption: resultMessage,
            mimetype: 'image/jpeg'
          });
        } else {
          // Send text only if thumbnail failed
          await sock.sendMessage(sender, {
            text: resultMessage
          });
        }
        
      } catch (error) {
        console.error('Error searching YouTube:', error);
        await sock.sendMessage(sender, {
          text: formatMessage("Failed to search for videos. Make sure yt-dlp is installed on your system or try another search term.")
        });
      }
    } catch (error) {
      console.error('Error in play command:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("An error occurred while searching. Please try again later.")
      });
    }
  }
};

// Helper function to format duration
function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}