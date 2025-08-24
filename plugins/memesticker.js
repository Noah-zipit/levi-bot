// plugins/memesticker.js
const { formatMessage } = require('../utils/messages');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const Jimp = require('jimp');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'meme',
  description: 'Create a funny meme sticker from a tagged message',
  category: 'Fun',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    // Check if message is a reply
    if (!message.message.extendedTextMessage?.contextInfo?.quotedMessage) {
      await sock.sendMessage(sender, {
        text: formatMessage("You need to reply to a message to create a meme sticker!")
      });
      return;
    }
    
    const quotedMessage = message.message.extendedTextMessage.contextInfo.quotedMessage;
    const hasImage = quotedMessage.imageMessage;
    
    // If there's no image, we'll just use the text to create a meme
    const memeText = quotedMessage.conversation || 
                    quotedMessage.extendedTextMessage?.text || 
                    args.join(' ') || 
                    "Funny Meme";
    
    try {
      // Send processing message
      await sock.sendMessage(sender, { 
        text: formatMessage("Creating meme sticker... Please wait.")
      });
      
      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Generate unique filename
      const filename = `meme_${uuidv4()}`;
      const outputPath = path.join(tempDir, `${filename}.webp`);
      
      if (hasImage) {
        // If there's an image, use it as the base for the meme
        const stream = await downloadContentFromMessage(quotedMessage.imageMessage, 'image');
        const buffer = [];
        
        for await (const chunk of stream) {
          buffer.push(chunk);
        }
        
        const imageBuffer = Buffer.concat(buffer);
        
        // Create meme from image
        await createMemeFromImage(imageBuffer, outputPath, memeText);
      } else {
        // If there's no image, create a text-only meme
        await createTextMeme(outputPath, memeText);
      }
      
      // Send sticker
      await sock.sendMessage(sender, { 
        sticker: { url: outputPath }
      });
      
      // Clean up output file
      try {
        fs.unlinkSync(outputPath);
      } catch (err) {
        console.error('Error cleaning up output file:', err);
      }
      
    } catch (error) {
      console.error('Error creating meme sticker:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error creating the meme sticker. Please try again.")
      });
    }
  }
};

// Create meme from image using Jimp and Sharp
async function createMemeFromImage(imageBuffer, outputPath, text) {
  try {
    // Use Jimp to add text to the image
    const image = await Jimp.read(imageBuffer);
    const width = image.getWidth();
    const height = image.getHeight();
    
    // Load font
    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    
    // Apply random effect to image
    const effectType = Math.floor(Math.random() * 4);
    
    switch (effectType) {
      case 0:
        // Increase contrast
        image.contrast(0.3);
        break;
      case 1:
        // Add brightness
        image.brightness(0.2);
        break;
      case 2:
        // Apply sepia-like effect
        image.sepia();
        break;
      case 3:
        // Apply posterize effect
        image.posterize(5);
        break;
    }
    
    // Add meme text at the bottom
    const maxWidth = width - 20;
    const textLines = wrapText(text, maxWidth);
    
    // Print text at the bottom
    let y = height - (textLines.length * 40) - 10;
    textLines.forEach(line => {
      const textWidth = Jimp.measureText(font, line);
      const x = (width - textWidth) / 2;
      image.print(font, x, y, line);
      y += 40;
    });
    
    // Save the processed image
    const tempOutputPath = outputPath.replace('.webp', '.png');
    await image.writeAsync(tempOutputPath);
    
    // Convert to webp using Sharp
    await sharp(tempOutputPath)
      .resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 80 })
      .toFile(outputPath);
    
    // Delete temporary file
    fs.unlinkSync(tempOutputPath);
    
  } catch (error) {
    console.error('Error in createMemeFromImage:', error);
    throw error;
  }
}

// Create text-only meme
async function createTextMeme(outputPath, text) {
  try {
    // Create a new image with Jimp
    const image = new Jimp(512, 512, getRandomColor());
    
    // Load font
    const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    
    // Add random emoji background
    await addRandomEmojis(image);
    
    // Add text in the center
    const maxWidth = 480;
    const textLines = wrapText(text, maxWidth);
    
    const lineHeight = 70;
    const totalHeight = lineHeight * textLines.length;
    const startY = (512 - totalHeight) / 2;
    
    textLines.forEach((line, i) => {
      const textWidth = Jimp.measureText(font, line);
      const x = (512 - textWidth) / 2;
      const y = startY + (i * lineHeight);
      image.print(font, x, y, line);
    });
    
    // Save the processed image
    const tempOutputPath = outputPath.replace('.webp', '.png');
    await image.writeAsync(tempOutputPath);
    
    // Convert to webp using Sharp
    await sharp(tempOutputPath)
      .resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 80 })
      .toFile(outputPath);
    
    // Delete temporary file
    fs.unlinkSync(tempOutputPath);
    
  } catch (error) {
    console.error('Error in createTextMeme:', error);
    throw error;
  }
}

// Helper functions
function wrapText(text, maxWidth) {
  // Simple text wrapping function
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine + word + ' ';
    
    if (testLine.length * 20 > maxWidth) { // Simple width estimation
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }
  
  return lines;
}

async function addRandomEmojis(image) {
  const emojis = ['😂', '🔥', '💯', '👌', '😎', '🤣', '😭', '🙄', '🤔', '👀'];
  
  // Use a smaller font for emojis
  const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  
  // Add some random emojis as background
  for (let i = 0; i < 10; i++) {
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const x = Math.floor(Math.random() * 512);
    const y = Math.floor(Math.random() * 512);
    
    image.print(font, x, y, emoji);
  }
}

function getRandomColor() {
  const colors = [0xFF5733, 0x33FF57, 0x3357FF, 0xF3FF33, 0xFF33F3, 0x33FFF3];
  return colors[Math.floor(Math.random() * colors.length)];
}
