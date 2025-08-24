const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'video',
  description: 'Download video from YouTube',
  category: 'utility',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    // Check if there's a pending download
    if (!global.pendingDownloads || !global.pendingDownloads[sender]) {
      await sock.sendMessage(sender, {
        text: formatMessage("No pending download. Search for a video first using !play <video name>")
      });
      return;
    }
    
    // Get the video info
    const downloadInfo = global.pendingDownloads[sender];
    
    try {
      // Send status message
      await sock.sendMessage(sender, {
        text: formatMessage("Downloading video... Please wait. This might take a while for longer videos.")
      });
      
      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Define file path
      const randomId = Math.floor(Math.random() * 10000);
      const videoPath = path.join(tempDir, `video_${randomId}.mp4`);
      
      // Download using yt-dlp
      try {
        execSync(`yt-dlp -f "best[height<=720][ext=mp4]" -o "${videoPath}" "https://www.youtube.com/watch?v=${downloadInfo.videoId}"`, {
          stdio: 'pipe'
        });
        
        // Check file size
        const stats = fs.statSync(videoPath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        
        if (fileSizeInMB > 15) {
          await sock.sendMessage(sender, {
            text: formatMessage("Video is too large to send (>15MB). Try a shorter video or use !audio instead.")
          });
          
          // Delete the temp file
          fs.unlinkSync(videoPath);
          return;
        }
        
        // Send the video file
        await sock.sendMessage(sender, {
          video: fs.readFileSync(videoPath),
          caption: `${downloadInfo.title}`,
          mimetype: 'video/mp4',
          fileName: `${downloadInfo.title}.mp4`
        });
        
        // Clean up
        delete global.pendingDownloads[sender];
        
        // Delete the temp file
        fs.unlinkSync(videoPath);
      } catch (error) {
        console.error('Failed to download with yt-dlp:', error);
        await sock.sendMessage(sender, {
          text: formatMessage("Failed to download. Make sure yt-dlp is installed on your system or try another video.")
        });
      }
    } catch (error) {
      console.error('Error in video command:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("An error occurred while downloading. Please try again later.")
      });
    }
  }
};