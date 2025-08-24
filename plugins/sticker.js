const fs = require('fs');
const path = require('path');
const { formatMessage } = require('../utils/messages');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const Jimp = require('jimp');

module.exports = {
  name: 'sticker',
  description: 'Convert image to sticker',
  category: 'utility',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    try {
      // Check if message contains image
      const hasQuotedImage = message.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
      const hasImage = message.message.imageMessage || hasQuotedImage;
      
      if (!hasImage) {
        await sock.sendMessage(sender, {
          text: formatMessage("Please send an image or reply to an image with !sticker")
        });
        return;
      }
      
      // Send processing message
      await sock.sendMessage(sender, {
        text: formatMessage("Processing image into a sticker... Please wait.")
      });
      
      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Download the image
      let imageMessage;
      if (message.message.imageMessage) {
        imageMessage = message.message;
      } else {
        imageMessage = {
          message: {
            imageMessage: message.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage
          }
        };
      }
      
      const buffer = await downloadMediaMessage(
        imageMessage,
        'buffer',
        {},
        {
          logger: console,
          reuploadRequest: sock.updateMediaMessage
        }
      );
      
      // Generate random file names
      const randomId = Math.floor(Math.random() * 10000);
      const inputFile = path.join(tempDir, `input_${randomId}.jpeg`);
      const outputFile = path.join(tempDir, `sticker_${randomId}.webp`);
      
      // Save buffer to file
      fs.writeFileSync(inputFile, buffer);
      
      // Process with Jimp
      const image = await Jimp.read(inputFile);
      image.resize(512, 512);
      await image.writeAsync(outputFile);
      
      // Send as sticker
      await sock.sendMessage(sender, {
        sticker: fs.readFileSync(outputFile),
        mimetype: 'image/webp'
      });
      
      // Clean up temp files
      fs.unlinkSync(inputFile);
      fs.unlinkSync(outputFile);
      
    } catch (error) {
      console.error('Error creating sticker:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error creating the sticker. Please try again.")
      });
    }
  }
};