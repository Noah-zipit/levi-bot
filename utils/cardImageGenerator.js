const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const logger = require('./logger');

/**
 * Generate a visual card image with stats and information
 * @param {Object} card - Card data
 * @param {Object} userCard - User card data (level, exp, etc)
 * @returns {Promise<Buffer>} - Image buffer
 */
async function generateCardImage(card, userCard) {
  try {
    // Create base canvas (400x600)
    const canvas = new Jimp(400, 600);
    
    // Set background color based on rarity
    const colors = {
      common: 0x555555FF,    // Gray
      uncommon: 0x00AA00FF,  // Green
      rare: 0x0000AAFF,      // Blue
      epic: 0xAA00AAFF,      // Purple
      legendary: 0xFFAA00FF   // Gold
    };
    
    // Fill with rarity color
    canvas.background(colors[card.rarity] || 0x555555FF);
    
    // Try to load frame based on rarity
    try {
      const frameAssetPath = path.join(__dirname, '..', 'assets', 'frames', `${card.rarity}.png`);
      if (fs.existsSync(frameAssetPath)) {
        const frame = await Jimp.read(frameAssetPath);
        canvas.composite(frame, 0, 0);
      }
    } catch (frameErr) {
      // Frame loading failed, already have the colored background as fallback
      logger.info('Frame not found, using color background');
    }
    
    // Load character image
    let characterImage;
    try {
      // Try direct URL
      characterImage = await Jimp.read(card.imageUrl);
    } catch (err) {
      // If direct load fails, try downloading first
      try {
        const response = await axios.get(card.imageUrl, { responseType: 'arraybuffer' });
        characterImage = await Jimp.read(Buffer.from(response.data));
      } catch (err2) {
        // If all fails, use placeholder
        characterImage = new Jimp(300, 300, 0x000000FF);
      }
    }
    
    // Resize character image to fit card (300x300)
    characterImage.resize(300, 300);
    
    // Create semi-transparent overlay for the bottom part of the card
    const overlay = new Jimp(400, 250, 0x00000099);
    
    // Load font
    let font24, font16, font14;
    
    try {
      font24 = await Jimp.loadFont(Jimp.FONT_SANS_24_WHITE);
      font16 = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
      font14 = await Jimp.loadFont(Jimp.FONT_SANS_14_WHITE);
    } catch (fontErr) {
      logger.error('Error loading fonts:', fontErr);
      // Continue without text if fonts fail to load
    }
    
    // Compose the card
    canvas.composite(characterImage, 50, 50);     // Add character image
    canvas.composite(overlay, 0, 350);            // Add text background overlay
    
    // Add card information if fonts loaded successfully
    if (font24 && font16) {
      // Add card name
      canvas.print(font24, 20, 360, card.name || "Unknown Character");
      
      // Add anime
      canvas.print(font16, 20, 395, `Anime: ${card.anime || "Unknown"}`);
      
      // Add rarity with stars
      let rarityText = 'Rarity: ';
      const stars = getRarityStars(card.rarity);
      canvas.print(font16, 20, 420, `${rarityText}${stars}`);
      
      // Add type
      canvas.print(font16, 20, 445, `Type: ${capitalize(card.type || "Unknown")}`);
      
      // Add stats
      const attack = userCard ? getAdjustedStat(card.stats.attack, userCard.level) : (card.stats ? card.stats.attack : 50);
      const defense = userCard ? getAdjustedStat(card.stats.defense, userCard.level) : (card.stats ? card.stats.defense : 50);
      const speed = userCard ? getAdjustedStat(card.stats.speed, userCard.level) : (card.stats ? card.stats.speed : 50);
      
      canvas.print(font16, 20, 470, `⚔️ ATK: ${attack}   🛡️ DEF: ${defense}   ⚡ SPD: ${speed}`);
      
      // Add ability
      if (card.ability && card.ability.name) {
        canvas.print(font16, 20, 495, `Ability: ${card.ability.name}`);
        
        // Break the description into multiple lines if needed
        if (card.ability.description) {
          const words = card.ability.description.split(' ');
          let line = '';
          let lineY = 520;
          
          words.forEach(word => {
            const testLine = line + word + ' ';
            const testWidth = Jimp.measureText(font14, testLine);
            
            if (testWidth > 360) {
              canvas.print(font14, 20, lineY, line);
              line = word + ' ';
              lineY += 20;
            } else {
              line = testLine;
            }
          });
          
          // Print last line
          if (line) {
            canvas.print(font14, 20, lineY, line);
          }
        }
      }
      
      // Add level if userCard is provided
      if (userCard) {
        const levelY = card.ability ? 560 : 520;
        canvas.print(font16, 20, levelY, `Level: ${userCard.level}   EXP: ${userCard.exp}/${userCard.level * 100}`);
        
        // Draw experience bar
        const barWidth = 360;
        const progress = Math.min(1, userCard.exp / (userCard.level * 100));
        const progressWidth = Math.floor(barWidth * progress);
        
        // Y position for exp bar
        const barY = levelY + 25;
        
        // Draw empty bar
        for (let x = 20; x < 20 + barWidth; x++) {
          for (let y = barY; y < barY + 15; y++) {
            canvas.setPixelColor(0x646464FF, x, y);
          }
        }
        
        // Draw filled progress
        for (let x = 20; x < 20 + progressWidth; x++) {
          for (let y = barY; y < barY + 15; y++) {
            canvas.setPixelColor(0x00AA00FF, x, y);
          }
        }
      }
    }
    
    // Return as buffer
    return await canvas.getBufferAsync(Jimp.MIME_PNG);
  } catch (error) {
    logger.error('Error generating card image:', error);
    throw error;
  }
}

/**
 * Generates a collage of multiple cards (for deck display)
 * @param {Array} cards - Array of card objects with userCard data
 * @returns {Promise<Buffer>} - Image buffer
 */
async function generateDeckImage(cards) {
  try {
    // Determine grid size based on number of cards
    const cardsPerRow = Math.min(3, cards.length);
    const rows = Math.ceil(cards.length / cardsPerRow);
    
    // Create canvas with appropriate size
    const cardWidth = 200;
    const cardHeight = 300;
    const padding = 10;
    const width = (cardWidth * cardsPerRow) + (padding * (cardsPerRow + 1));
    const height = (cardHeight * rows) + (padding * (rows + 1));
    
    const canvas = new Jimp(width, height, 0x222222FF);
    
    // Generate and place each card
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i].card;
      const userCard = cards[i].userCard;
      
      // Generate individual card image
      const cardImage = await generateCardImage(card, userCard);
      const cardJimp = await Jimp.read(cardImage);
      
      // Resize to fit in grid
      cardJimp.resize(cardWidth, cardHeight);
      
      // Calculate position
      const row = Math.floor(i / cardsPerRow);
      const col = i % cardsPerRow;
      const x = padding + (col * (cardWidth + padding));
      const y = padding + (row * (cardHeight + padding));
      
      // Place on canvas
      canvas.composite(cardJimp, x, y);
    }
    
    // Add deck title at the bottom
    try {
      const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
      canvas.print(font, padding, height - 50, 'BATTLE DECK');
    } catch (fontErr) {
      // Continue without text if font fails to load
    }
    
    // Return as buffer
    return await canvas.getBufferAsync(Jimp.MIME_PNG);
  } catch (error) {
    logger.error('Error generating deck image:', error);
    throw error;
  }
}

// Helper functions
function getRarityStars(rarity) {
  switch (rarity) {
    case 'legendary': return '★★★★★';
    case 'epic': return '★★★★☆';
    case 'rare': return '★★★☆☆';
    case 'uncommon': return '★★☆☆☆';
    case 'common': return '★☆☆☆☆';
    default: return '☆☆☆☆☆';
  }
}

function capitalize(string) {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function getAdjustedStat(baseStat, level) {
  if (!baseStat || !level) return 50;
  // Formula: Base stat increases by 5% per level
  return Math.floor(baseStat * (1 + (level - 1) * 0.05));
}

module.exports = {
  generateCardImage,
  generateDeckImage
};