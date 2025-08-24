// plugins/sticker.js
const { formatMessage } = require('../utils/messages');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'sticker',
  description: 'Convert image or video to sticker',
  category: 'Media',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    // Check if message has image or video
    const isImage = message.message && (message.message.imageMessage || message.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage);
    const isVideo = message.message && (message.message.videoMessage || message.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage);
    
    if (!isImage && !isVideo) {
      await sock.sendMessage(sender, {
        text: formatMessage("Please send an image or video with the caption !sticker, or reply to an image/video with !sticker")
      });
      return;
    }
    
    try {
      // Send processing message
      await sock.sendMessage(sender, { 
        text: formatMessage("Creating sticker... Please wait.")
      });
      
      // Get quoted message if it's a reply
      let mediaMessage;
      if (message.message.extendedTextMessage?.contextInfo?.quotedMessage) {
        if (message.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage) {
          mediaMessage = message.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
        } else if (message.message.extendedTextMessage.contextInfo.quotedMessage.videoMessage) {
          mediaMessage = message.message.extendedTextMessage.contextInfo.quotedMessage.videoMessage;
        }
      } else {
        mediaMessage = message.message.imageMessage || message.message.videoMessage;
      }
      
      // Check media type
      const isGif = mediaMessage?.mimetype?.includes('gif') || false;
      const isVideoFile = mediaMessage?.mimetype?.includes('video') || false;
      
      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Download media
      const stream = await downloadContentFromMessage(mediaMessage, isImage ? 'image' : 'video');
      const buffer = Buffer.from([]);
      
      // Generate unique filename
      const filename = `${uuidv4()}`;
      const inputPath = path.join(tempDir, `${filename}.${isImage ? 'jpg' : 'mp4'}`);
      const outputPath = path.join(tempDir, `${filename}.webp`);
      
      // Stream to file
      const fileStream = fs.createWriteStream(inputPath);
      for await (const chunk of stream) {
        fileStream.write(chunk);
      }
      fileStream.end();
      
      // Wait for file to be written
      await new Promise((resolve) => fileStream.on('finish', resolve));
      
      // Process based on media type
      if (isImage) {
        // Convert image to sticker
        await convertImageToSticker(inputPath, outputPath);
      } else {
        // Convert video to sticker
        await convertVideoToSticker(inputPath, outputPath, isGif);
      }
      
      // Send sticker
      await sock.sendMessage(sender, { 
        sticker: { url: outputPath }
      });
      
      // Clean up temp files
      try {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      } catch (err) {
        console.error('Error cleaning up temp files:', err);
      }
      
    } catch (error) {
      console.error('Error creating sticker:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error creating the sticker. Please try again.")
      });
    }
  }
};

// Convert image to sticker
async function convertImageToSticker(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vcodec", "libwebp",
        "-vf", "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse",
        "-loop", "0",
        "-ss", "00:00:00.0",
        "-t", "00:00:10.0",
        "-preset", "default",
        "-an", "-vsync", "0"
      ])
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

// Convert video to sticker
async function convertVideoToSticker(inputPath, outputPath, isGif) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vcodec", "libwebp",
        "-vf", "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse",
        "-loop", "0",
        "-ss", "00:00:00.0",
        "-t", "00:00:10.0",
        "-preset", "default",
        "-an", "-vsync", "0"
      ])
      .toFormat('webp')
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}