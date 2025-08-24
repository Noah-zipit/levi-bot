const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'audio',
  description: 'Download audio from YouTube',
  category: 'utility',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    // Check if there's a pending download
    if (!global.pendingDownloads || !global.pendingDownloads[sender]) {
      await sock.sendMessage(sender, {
        text: formatMessage("No pending download. Search for a song first using !play <song name>")
      });
      return;
    }
    
    // Get the video info
    const downloadInfo = global.pendingDownloads[sender];
    
    try {
      // Send status message
      await sock.sendMessage(sender, {
        text: formatMessage("Downloading audio... Please wait.")
      });
      
      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Define file paths
      const randomId = Math.floor(Math.random() * 10000);
      const audioPath = path.join(tempDir, `audio_${randomId}.mp3`);
      
      // Download using yt-dlp
      try {
        execSync(`yt-dlp -x --audio-format mp3 --audio-quality 128K -o "${audioPath}" "https://www.youtube.com/watch?v=${downloadInfo.videoId}"`, {
          stdio: 'pipe'
        });
        
        // Check file size
        const stats = fs.statSync(audioPath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        
        if (fileSizeInMB > 15) {
          await sock.sendMessage(sender, {
            text: formatMessage("Audio file is too large to send (>15MB). Try a shorter song.")
          });
          
          // Delete the temp file
          fs.unlinkSync(audioPath);
          return;
        }
        
        // Send the audio file
        await sock.sendMessage(sender, {
          audio: fs.readFileSync(audioPath),
          mimetype: 'audio/mp3',
          fileName: `${downloadInfo.title}.mp3`
        });
        
        // Clean up
        delete global.pendingDownloads[sender];
        
        // Delete the temp file
        fs.unlinkSync(audioPath);
      } catch (error) {
        console.error('Failed to download with yt-dlp:', error);
        await sock.sendMessage(sender, {
          text: formatMessage("Failed to download. Make sure yt-dlp is installed on your system or try another video.")
        });
      }
    } catch (error) {
      console.error('Error in audio command:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("An error occurred while downloading. Please try again later.")
      });
    }
  }
};