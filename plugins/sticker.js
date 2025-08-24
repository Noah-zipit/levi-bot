// plugins/sticker.js
const { formatMessage } = require('../utils/messages');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { downloadContentFromMessage } = require('baileys');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'sticker',
  description: 'Convert image or video to sticker',
  category: 'Media',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    // Check if message has image
    const isImage = message.message && (message.message.imageMessage || message.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage);
    
    if (!isImage) {
      await sock.sendMessage(sender, {
        text: formatMessage("Please send an image with the caption !sticker, or reply to an image with !sticker")
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
        }
      } else {
        mediaMessage = message.message.imageMessage;
      }
      
      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Download media
      const stream = await downloadContentFromMessage(mediaMessage, 'image');
      const buffer = [];
      
      for await (const chunk of stream) {
        buffer.push(chunk);
      }
      
      const imageBuffer = Buffer.concat(buffer);
      
      // Generate unique filename
      const filename = `${uuidv4()}`;
      const outputPath = path.join(tempDir, `${filename}.webp`);
      
      // Convert image to sticker using Sharp
      await sharp(imageBuffer)
        .resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 80 })
        .toFile(outputPath);
      
      // Send sticker
      await sock.sendMessage(sender, { 
        sticker: { url: outputPath }
      });
      
      // Clean up temp files
      try {
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
