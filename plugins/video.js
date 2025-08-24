// plugins/video.js
const { formatMessage } = require('../utils/messages');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const { v4: uuidv4 } = require('uuid');
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');

module.exports = {
  name: 'video',
  description: 'Download and send a YouTube video',
  category: 'Media',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    if (!args.length) {
      await sock.sendMessage(sender, {
        text: formatMessage("Please provide a YouTube video URL. Example: !video https://www.youtube.com/watch?v=dQw4w9WgXcQ")
      });
      return;
    }
    
    const url = args[0];
    
    // Validate YouTube URL
    if (!ytdl.validateURL(url)) {
      await sock.sendMessage(sender, {
        text: formatMessage("Please provide a valid YouTube video URL.")
      });
      return;
    }
    
    try {
      // Send processing message
      await sock.sendMessage(sender, { 
        text: formatMessage("Downloading video... This might take a while.")
      });
      
      // Get video info
      const info = await ytdl.getInfo(url);
      const videoTitle = info.videoDetails.title;
      
      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Generate unique filename
      const filename = `${uuidv4()}`;
      const outputPath = path.join(tempDir, `${filename}.mp4`);
      
      // Get the lowest quality format that's a video with audio
      const format = ytdl.chooseFormat(info.formats, { 
        quality: 'lowest', 
        filter: 'audioandvideo' 
      });
      
      if (!format) {
        throw new Error('No suitable format found');
      }
      
      // Download and process video with ytdl
      const videoStream = ytdl(url, { format: format });
      
      // Create write stream
      const writeStream = fs.createWriteStream(outputPath);
      
      // Pipe video to file
      videoStream.pipe(writeStream);
      
      // Handle completion
      writeStream.on('finish', async () => {
        try {
          // Check file size
          const stats = fs.statSync(outputPath);
          const fileSizeInMB = stats.size / (1024 * 1024);
          
          if (fileSizeInMB > 15) {
            await sock.sendMessage(sender, {
              text: formatMessage("The video is too large to send (>15MB). Try a shorter video.")
            });
            
            // Clean up
            fs.unlinkSync(outputPath);
            return;
          }
          
          // Send video
          await sock.sendMessage(sender, { 
            video: { url: outputPath },
            caption: formatMessage(`${videoTitle}\n\nRequested by ${message.pushName || user.userId}`)
          });
          
          // Clean up
          fs.unlinkSync(outputPath);
        } catch (error) {
          console.error('Error sending video:', error);
          await sock.sendMessage(sender, {
            text: formatMessage("There was an error sending the video. Please try again with a different video.")
          });
          
          // Clean up
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
        }
      });
      
      // Handle errors
      videoStream.on('error', async (error) => {
        console.error('Error downloading video:', error);
        await sock.sendMessage(sender, {
          text: formatMessage("There was an error downloading the video. Please try again.")
        });
      });
      
    } catch (error) {
      console.error('Error processing YouTube video:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error processing the YouTube video. Please try a different video or check the URL.")
      });
    }
  }
};
