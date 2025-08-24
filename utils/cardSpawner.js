const Card = require('../database/models/card');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('./logger');

// Spawn cooldown by group (to prevent spam)
const groupCooldowns = new Map();
const activeSpawns = new Map();

/**
 * Attempts to spawn a card in a group chat based on probabilities
 * @param {Object} sock - WhatsApp socket
 * @param {String} groupId - Group chat ID
 * @param {Boolean} force - Force spawn regardless of cooldown
 * @returns {Promise<Boolean>} - Whether a card was spawned
 */
async function attemptCardSpawn(sock, groupId, force = false) {
  try {
    // Check cooldown (unless forced)
    if (!force && groupCooldowns.has(groupId)) {
      const lastSpawn = groupCooldowns.get(groupId);
      const cooldownTime = 30 * 60 * 1000; // 30 minutes
      if (Date.now() - lastSpawn < cooldownTime) {
        return false;
      }
    }
    
    // Check if there's already an active spawn
    if (activeSpawns.has(groupId)) {
      return false; // Don't spawn if there's already an active spawn
    }
    
    // 5% chance to spawn a card on any message (unless forced)
    if (!force && Math.random() > 0.05) {
      return false;
    }
    
    // Get a random card based on rarity
    const card = await getRandomCard();
    if (!card) return false;
    
    // Build the card spawn message with full details
    let spawnMessage = `🎴 *A wild ${card.name} appeared!* 🎴\n\n`;
    spawnMessage += `*Anime:* ${card.anime || "Unknown"}\n`;
    spawnMessage += `*Rarity:* ${getRarityEmoji(card.rarity)} ${capitalize(card.rarity || "common")}\n`;
    spawnMessage += `*Type:* ${capitalize(card.type || "Unknown")}\n\n`;
    
    // Stats section
    spawnMessage += `*Stats:*\n`;
    if (card.stats) {
      spawnMessage += `⚔️ Attack: ${card.stats.attack || 0}\n`;
      spawnMessage += `🛡️ Defense: ${card.stats.defense || 0}\n`;
      spawnMessage += `⚡ Speed: ${card.stats.speed || 0}\n\n`;
    } else {
      spawnMessage += "No stats available\n\n";
    }
    
    // Ability section
    if (card.ability && card.ability.name) {
      spawnMessage += `*Ability:* ${card.ability.name}\n`;
      if (card.ability.description) {
        spawnMessage += `*Effect:* ${card.ability.description}\n\n`;
      }
    }
    
    spawnMessage += `Use !catch ${card.name} to catch this character!`;
    
    // Download the original image
    let cardImage;
    try {
      cardImage = await downloadImage(card.imageUrl);
    } catch (downloadError) {
      logger.error('Failed to download image:', downloadError);
      return false; // Can't proceed without image
    }
    
    // Send card spawn message with original image
    await sock.sendMessage(groupId, {
      image: cardImage,
      caption: spawnMessage,
      mimetype: 'image/jpeg'
    });
    
    // Set group on cooldown
    groupCooldowns.set(groupId, Date.now());
    
    // Store active spawn data
    activeSpawns.set(groupId, {
      cardId: card.cardId,
      spawnTime: Date.now(),
      expires: Date.now() + (5 * 60 * 1000) // Expires in 5 minutes
    });
    
    // Set timeout to remove spawn if not caught
    setTimeout(() => {
      if (activeSpawns.has(groupId) && 
          activeSpawns.get(groupId).cardId === card.cardId) {
        activeSpawns.delete(groupId);
        sock.sendMessage(groupId, {
          text: `The ${card.name} got away!`
        }).catch(err => logger.error('Error sending despawn message:', err));
      }
    }, 5 * 60 * 1000);
    
    return true;
  } catch (error) {
    logger.error('Error spawning card:', error);
    return false;
  }
}

/**
 * Spawns a specific card in a group chat
 * @param {Object} sock - WhatsApp socket
 * @param {String} groupId - Group chat ID
 * @param {Object} card - Card to spawn
 * @returns {Promise<Boolean>} - Whether the card was spawned
 */
async function spawnSpecificCard(sock, groupId, card) {
  try {
    // Check if there's already an active spawn
    if (activeSpawns.has(groupId)) {
      return false; // Don't spawn if there's already an active spawn
    }
    
    // Build the card spawn message with full details
    let spawnMessage = `🎴 *A wild ${card.name} appeared!* 🎴\n\n`;
    spawnMessage += `*Anime:* ${card.anime || "Unknown"}\n`;
    spawnMessage += `*Rarity:* ${getRarityEmoji(card.rarity)} ${capitalize(card.rarity || "common")}\n`;
    spawnMessage += `*Type:* ${capitalize(card.type || "Unknown")}\n\n`;
    
    // Stats section
    spawnMessage += `*Stats:*\n`;
    if (card.stats) {
      spawnMessage += `⚔️ Attack: ${card.stats.attack || 0}\n`;
      spawnMessage += `🛡️ Defense: ${card.stats.defense || 0}\n`;
      spawnMessage += `⚡ Speed: ${card.stats.speed || 0}\n\n`;
    } else {
      spawnMessage += "No stats available\n\n";
    }
    
    // Ability section
    if (card.ability && card.ability.name) {
      spawnMessage += `*Ability:* ${card.ability.name}\n`;
      if (card.ability.description) {
        spawnMessage += `*Effect:* ${card.ability.description}\n\n`;
      }
    }
    
    spawnMessage += `Use !catch ${card.name} to catch this character!`;
    
    // Download the original image
    let cardImage;
    try {
      cardImage = await downloadImage(card.imageUrl);
    } catch (downloadError) {
      logger.error('Failed to download image:', downloadError);
      return false; // Can't proceed without image
    }
    
    // Send card spawn message with original image
    await sock.sendMessage(groupId, {
      image: cardImage,
      caption: spawnMessage,
      mimetype: 'image/jpeg'
    });
    
    // Set group on cooldown
    groupCooldowns.set(groupId, Date.now());
    
    // Store active spawn data
    activeSpawns.set(groupId, {
      cardId: card.cardId,
      spawnTime: Date.now(),
      expires: Date.now() + (5 * 60 * 1000) // Expires in 5 minutes
    });
    
    // Set timeout to remove spawn if not caught
    setTimeout(() => {
      if (activeSpawns.has(groupId) && 
          activeSpawns.get(groupId).cardId === card.cardId) {
        activeSpawns.delete(groupId);
        sock.sendMessage(groupId, {
          text: `The ${card.name} got away!`
        }).catch(err => logger.error('Error sending despawn message:', err));
      }
    }, 5 * 60 * 1000);
    
    return true;
  } catch (error) {
    logger.error('Error spawning specific card:', error);
    return false;
  }
}

/**
 * Gets a random card from the database based on rarity
 */
async function getRandomCard() {
  try {
    // Determine rarity based on probabilities
    const rarityRoll = Math.random() * 100;
    let rarity;
    
    if (rarityRoll < 1) {           // 1% chance
      rarity = 'legendary';
    } else if (rarityRoll < 5) {    // 4% chance
      rarity = 'epic';
    } else if (rarityRoll < 15) {   // 10% chance
      rarity = 'rare';
    } else if (rarityRoll < 40) {   // 25% chance
      rarity = 'uncommon';
    } else {                        // 60% chance
      rarity = 'common';
    }
    
    // Query a random card of that rarity
    const cards = await Card.find({ rarity });
    if (cards.length === 0) {
      return null;
    }
    
    return cards[Math.floor(Math.random() * cards.length)];
  } catch (error) {
    logger.error('Error getting random card:', error);
    return null;
  }
}

/**
 * Downloads an image from URL and returns buffer
 */
async function downloadImage(url) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    logger.error(`Error downloading image from ${url}:`, error);
    throw error;
  }
}

// Helper functions
function getRarityEmoji(rarity) {
  switch (rarity) {
    case 'legendary': return '🌟';
    case 'epic': return '💫';
    case 'rare': return '✨';
    case 'uncommon': return '⚡';
    case 'common': return '🔹';
    default: return '🎴';
  }
}

function capitalize(string) {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = {
  attemptCardSpawn,
  spawnSpecificCard,
  activeSpawns,
  getRandomCard
};