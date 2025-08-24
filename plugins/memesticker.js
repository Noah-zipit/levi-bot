// plugins/memesticker.js
const { formatMessage } = require('../utils/messages');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');

// Register fonts if needed
try {
  const fontsDir = path.join(__dirname, '../assets/fonts');
  if (fs.existsSync(path.join(fontsDir, 'Impact.ttf'))) {
    registerFont(path.join(fontsDir, 'Impact.ttf'), { family: 'Impact' });
  }
} catch (error) {
  console.error('Error registering fonts:', error);
}

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
        const buffer = Buffer.from([]);
        const inputPath = path.join(tempDir, `${filename}.jpg`);
        
        // Stream to file
        const fileStream = fs.createWriteStream(inputPath);
        for await (const chunk of stream) {
          fileStream.write(chunk);
        }
        fileStream.end();
        
        // Wait for file to be written
        await new Promise((resolve) => fileStream.on('finish', resolve));
        
        // Create meme from image
        await createMemeFromImage(inputPath, outputPath, memeText);
        
        // Clean up input file
        try {
          fs.unlinkSync(inputPath);
        } catch (err) {
          console.error('Error cleaning up input file:', err);
        }
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

// Create meme from image
async function createMemeFromImage(inputPath, outputPath, text) {
  try {
    // Load the image
    const image = await loadImage(inputPath);
    
    // Create canvas with the same dimensions as the image
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Draw the image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    
    // Random funny effects
    const effectType = Math.floor(Math.random() * 5);
    
    switch (effectType) {
      case 0:
        // Classic meme text (white with black outline, top and bottom)
        addMemeText(ctx, canvas, text);
        break;
      case 1:
        // Deepfry effect
        applyDeepfryEffect(ctx, canvas);
        addMemeText(ctx, canvas, text);
        break;
      case 2:
        // Glitch effect
        applyGlitchEffect(ctx, canvas);
        addMemeText(ctx, canvas, text);
        break;
      case 3:
        // Crying emoji overlay
        addCryingEmoji(ctx, canvas);
        addMemeText(ctx, canvas, text);
        break;
      case 4:
        // Random rotation
        applyRotation(ctx, canvas, image);
        addMemeText(ctx, canvas, text);
        break;
    }
    
    // Save canvas to file
    const outputBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync(inputPath + '.png', outputBuffer);
    
    // Convert to webp
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath + '.png')
        .outputOptions([
          "-vcodec", "libwebp",
          "-vf", "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse",
          "-loop", "0",
          "-preset", "default",
          "-an", "-vsync", "0"
        ])
        .save(outputPath)
        .on('end', () => {
          // Clean up intermediate file
          fs.unlinkSync(inputPath + '.png');
          resolve();
        })
        .on('error', (err) => reject(err));
    });
    
  } catch (error) {
    console.error('Error in createMemeFromImage:', error);
    throw error;
  }
}

// Create text-only meme
async function createTextMeme(outputPath, text) {
  try {
    // Create canvas
    const canvas = createCanvas(512, 512);
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = randomColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add random emojis in background
    addRandomEmojis(ctx, canvas);
    
    // Add text
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    
    // Split text into lines
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > canvas.width - 40) {
        lines.push(currentLine);
        currentLine = word + ' ';
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
    
    // Draw text
    const lineHeight = 60;
    const totalHeight = lineHeight * lines.length;
    const startY = (canvas.height - totalHeight) / 2;
    
    lines.forEach((line, i) => {
      const y = startY + i * lineHeight;
      ctx.strokeText(line, canvas.width / 2, y);
      ctx.fillText(line, canvas.width / 2, y);
    });
    
    // Save canvas to file
    const tempPngPath = outputPath.replace('.webp', '.png');
    const outputBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync(tempPngPath, outputBuffer);
    
    // Convert to webp
    await new Promise((resolve, reject) => {
      ffmpeg(tempPngPath)
        .outputOptions([
          "-vcodec", "libwebp",
          "-vf", "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse",
          "-loop", "0",
          "-preset", "default",
          "-an", "-vsync", "0"
        ])
        .save(outputPath)
        .on('end', () => {
          // Clean up intermediate file
          fs.unlinkSync(tempPngPath);
          resolve();
        })
        .on('error', (err) => reject(err));
    });
    
  } catch (error) {
    console.error('Error in createTextMeme:', error);
    throw error;
  }
}

// Add classic meme text
function addMemeText(ctx, canvas, text) {
  const maxWidth = canvas.width - 20;
  
  // Split text in half for top and bottom
  const words = text.split(' ');
  const halfIndex = Math.ceil(words.length / 2);
  const topText = words.slice(0, halfIndex).join(' ').toUpperCase();
  const bottomText = words.slice(halfIndex).join(' ').toUpperCase();
  
  // Configure text style
  ctx.font = 'bold 40px Impact, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 3;
  
  // Draw top text
  const topLines = wrapText(ctx, topText, maxWidth);
  topLines.forEach((line, i) => {
    const y = 10 + (i * 42);
    ctx.strokeText(line, canvas.width / 2, y);
    ctx.fillText(line, canvas.width / 2, y);
  });
  
  // Draw bottom text
  const bottomLines = wrapText(ctx, bottomText, maxWidth);
  bottomLines.reverse().forEach((line, i) => {
    const y = canvas.height - 10 - ((bottomLines.length - i) * 42);
    ctx.strokeText(line, canvas.width / 2, y);
    ctx.fillText(line, canvas.width / 2, y);
  });
}

// Wrap text to fit canvas width
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth) {
      lines.push(currentLine);
      currentLine = word + ' ';
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  
  return lines;
}

// Deep fry effect
function applyDeepfryEffect(ctx, canvas) {
  // Increase contrast and saturation
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    // Increase red and yellow tones
    data[i] = Math.min(255, data[i] * 1.3);
    data[i + 1] = Math.min(255, data[i + 1] * 1.1);
    data[i + 2] = Math.max(0, data[i + 2] * 0.9);
    
    // Increase contrast
    for (let j = 0; j < 3; j++) {
      data[i + j] = Math.min(255, Math.max(0, (data[i + j] - 128) * 1.7 + 128));
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  // Add noise
  for (let i = 0; i < canvas.width * canvas.height * 0.05; i++) {
    const x = Math.floor(Math.random() * canvas.width);
    const y = Math.floor(Math.random() * canvas.height);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.2})`;
    ctx.fillRect(x, y, 2, 2);
  }
}

// Glitch effect
function applyGlitchEffect(ctx, canvas) {
  // Save original image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const originalData = new Uint8ClampedArray(data);
  
  // Create glitch areas
  const numGlitches = Math.floor(Math.random() * 10) + 5;
  
  for (let i = 0; i < numGlitches; i++) {
    const x = Math.floor(Math.random() * (canvas.width - 50));
    const y = Math.floor(Math.random() * canvas.height);
    const width = Math.floor(Math.random() * 50) + 20;
    const height = Math.floor(Math.random() * 20) + 5;
    const offsetX = Math.floor(Math.random() * 20) - 10;
    
    // Shift a slice of the image
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        if (x + dx < canvas.width && y + dy < canvas.height && x + dx + offsetX < canvas.width && x + dx + offsetX >= 0) {
          const sourceIndex = ((y + dy) * canvas.width + (x + dx)) * 4;
          const targetIndex = ((y + dy) * canvas.width + (x + dx + offsetX)) * 4;
          
          data[targetIndex] = originalData[sourceIndex];
          data[targetIndex + 1] = originalData[sourceIndex + 1];
          data[targetIndex + 2] = originalData[sourceIndex + 2];
        }
      }
    }
  }
  
  // Color channel shift
  const channelShift = Math.floor(Math.random() * 5) + 3;
  for (let i = 0; i < data.length; i += 4) {
    if (i + channelShift * 4 < data.length) {
      data[i] = originalData[i + channelShift * 4];
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}

// Add crying emoji overlay
function addCryingEmoji(ctx, canvas) {
  const emoji = '😂';
  const size = Math.min(canvas.width, canvas.height) * 0.5;
  
  ctx.font = `${size}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Add multiple emojis
  for (let i = 0; i < 3; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const rotation = (Math.random() - 0.5) * 0.5;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillText(emoji, 0, 0);
    ctx.restore();
  }
}

// Apply random rotation effect
function applyRotation(ctx, canvas, image) {
  const angle = (Math.random() - 0.5) * 0.3;
  
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(angle);
  ctx.drawImage(image, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
  ctx.restore();
}

// Add random emojis to background
function addRandomEmojis(ctx, canvas) {
  const emojis = ['😂', '🔥', '💯', '👌', '😎', '🤣', '😭', '🙄', '🤔', '👀'];
  
  for (let i = 0; i < 20; i++) {
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = Math.floor(Math.random() * 30) + 20;
    const rotation = Math.random() * Math.PI * 2;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.font = `${size}px Arial`;
    ctx.globalAlpha = 0.3;
    ctx.fillText(emoji, 0, 0);
    ctx.restore();
  }
  
  ctx.globalAlpha = 1.0;
}

// Generate random color
function randomColor() {
  const r = Math.floor(Math.random() * 255);
  const g = Math.floor(Math.random() * 255);
  const b = Math.floor(Math.random() * 255);
  return `rgb(${r}, ${g}, ${b})`;
}