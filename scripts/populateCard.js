// scripts/populateCard.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const axios = require('axios');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Define Card model directly in this script to ensure it's available
const cardSchema = new mongoose.Schema({
  cardId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  anime: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  type: {
    type: String,
    enum: ['attack', 'defense', 'balance', 'support'],
    default: 'balance'
  },
  stats: {
    attack: {
      type: Number,
      default: 50
    },
    defense: {
      type: Number,
      default: 50
    },
    speed: {
      type: Number,
      default: 50
    }
  },
  ability: {
    name: String,
    description: String,
    effect: String
  },
  spawnRate: {
    type: Number,
    default: 10
  }
}, {
  timestamps: true
});

const Card = mongoose.model('Card', cardSchema);

// Expanded anime list - 25 anime series
const ANIME_LIST = [
  // Original list
  'Attack on Titan',
  'Demon Slayer',
  'One Piece',
  'Naruto',
  'My Hero Academia',
  'Dragon Ball',
  'Jujutsu Kaisen',
  'Bleach',
  'Hunter x Hunter',
  'Fullmetal Alchemist',
  
  // Additional anime series
  'One Punch Man',
  'Tokyo Ghoul',
  'Sword Art Online',
  'Black Clover',
  'Death Note',
  'Chainsaw Man',
  'Fairy Tail',
  'Blue Lock',
  'Spy x Family',
  'Vinland Saga',
  'JoJo\'s Bizarre Adventure',
  'Haikyuu',
  'Code Geass',
  'Cowboy Bebop',
  'Fate/Stay Night'
];

// Rarities for each anime to ensure an even distribution
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

async function populateCards() {
  try {
    // Get MongoDB URI from environment variables
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/levibot';
    
    console.log(`Connecting to MongoDB: ${MONGODB_URI.split('@')[1] || 'localhost'}`); // Log without credentials
    
    // Connect to MongoDB with a longer timeout
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
      socketTimeoutMS: 45000,
    });
    
    console.log('Connected to database');
    
    // Count existing cards
    const existingCardCount = await Card.countDocuments();
    console.log(`Currently have ${existingCardCount} cards in the database`);
    
    // Track card creation count
    let cardCreationCount = 0;
    
    // Loop through each anime
    for (const anime of ANIME_LIST) {
      console.log(`Fetching characters for ${anime}...`);
      
      // Search for anime
      const animeSearchResponse = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(anime)}&limit=1`);
      
      if (!animeSearchResponse.data.data.length) {
        console.log(`No results found for ${anime}`);
        continue;
      }
      
      const animeId = animeSearchResponse.data.data[0].mal_id;
      
      // Delay to avoid rate limiting
      await delay(1000);
      
      // Fetch characters - increase limit to get more characters
      const characterResponse = await axios.get(`https://api.jikan.moe/v4/anime/${animeId}/characters`);
      
      if (!characterResponse.data.data.length) {
        console.log(`No characters found for ${anime}`);
        continue;
      }
      
      // Process more characters per anime (up to 20 instead of 10)
      let rarityIndex = 0;
      const charactersToProcess = Math.min(20, characterResponse.data.data.length);
      
      for (const character of characterResponse.data.data.slice(0, charactersToProcess)) {
        const charData = character.character;
        
        // Assign rarity in rotation
        const rarity = RARITIES[rarityIndex % RARITIES.length];
        rarityIndex++;
        
        // Generate random stats based on rarity
        const stats = generateStats(rarity);
        
        // Generate random ability
        const ability = generateAbility(rarity);
        
        // Check if character already exists
        const existingCard = await Card.findOne({ 
          name: charData.name,
          anime: anime
        });
        
        if (existingCard) {
          console.log(`Character ${charData.name} already exists, skipping...`);
          continue;
        }
        
        // Create card
        const card = new Card({
          cardId: uuidv4(),
          name: charData.name,
          anime: anime,
          imageUrl: charData.images.jpg.image_url,
          rarity: rarity,
          type: getRandomType(),
          stats: stats,
          ability: ability,
          spawnRate: getSpawnRateByRarity(rarity)
        });
        
        // Save card
        await card.save();
        cardCreationCount++;
        console.log(`Added ${charData.name} (${rarity}) from ${anime} [${cardCreationCount}]`);
        
        // Delay to avoid rate limiting
        await delay(300);
      }
      
      // Try to also fetch staff members (voice actors, etc.) for more cards if needed
      try {
        console.log(`Fetching staff for ${anime}...`);
        
        // Delay to avoid rate limiting
        await delay(1500);
        
        const staffResponse = await axios.get(`https://api.jikan.moe/v4/anime/${animeId}/staff`);
        
        if (staffResponse.data.data.length > 0) {
          // Process some staff members as special cards
          for (const staff of staffResponse.data.data.slice(0, 5)) { // Get a few staff
            const staffData = staff.person;
            const role = staff.positions.join(', ');
            
            // Generate special character name
            const cardName = `${staffData.name} (${role})`;
            
            // Check if character already exists
            const existingCard = await Card.findOne({ 
              name: cardName,
              anime: anime
            });
            
            if (existingCard) {
              console.log(`Staff card ${cardName} already exists, skipping...`);
              continue;
            }
            
            // Assign higher rarity for staff cards
            const staffRarity = RARITIES[Math.min(3, Math.floor(Math.random() * 5))]; // More likely to be rare+
            
            // Generate random stats based on rarity
            const stats = generateStats(staffRarity);
            
            // Generate random ability
            const ability = generateAbility(staffRarity);
            
            // Create card
            const card = new Card({
              cardId: uuidv4(),
              name: cardName,
              anime: anime,
              imageUrl: staffData.images.jpg.image_url,
              rarity: staffRarity,
              type: getRandomType(),
              stats: stats,
              ability: ability,
              spawnRate: getSpawnRateByRarity(staffRarity)
            });
            
            // Save card
            await card.save();
            cardCreationCount++;
            console.log(`Added staff card ${cardName} (${staffRarity}) from ${anime} [${cardCreationCount}]`);
            
            // Delay to avoid rate limiting
            await delay(300);
          }
        }
      } catch (staffError) {
        console.log(`Error fetching staff for ${anime}: ${staffError.message}`);
      }
      
      // Delay between animes to avoid rate limiting
      await delay(2000);
    }
    
    console.log(`Card population complete! Created ${cardCreationCount} new cards.`);
    console.log(`Total cards in database: ${existingCardCount + cardCreationCount}`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error populating cards:', error);
    try {
      await mongoose.connection.close();
    } catch (err) {
      console.error('Error closing MongoDB connection:', err);
    }
    process.exit(1);
  }
}

// Helper functions
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomType() {
  const types = ['attack', 'defense', 'balance', 'support'];
  return types[Math.floor(Math.random() * types.length)];
}

function generateStats(rarity) {
  // Base stats based on rarity
  let baseMin, baseMax;
  
  switch (rarity) {
    case 'legendary':
      baseMin = 80;
      baseMax = 100;
      break;
    case 'epic':
      baseMin = 70;
      baseMax = 90;
      break;
    case 'rare':
      baseMin = 60;
      baseMax = 80;
      break;
    case 'uncommon':
      baseMin = 50;
      baseMax = 70;
      break;
    case 'common':
    default:
      baseMin = 40;
      baseMax = 60;
      break;
  }
  
  // Generate random stats
  return {
    attack: Math.floor(Math.random() * (baseMax - baseMin + 1)) + baseMin,
    defense: Math.floor(Math.random() * (baseMax - baseMin + 1)) + baseMin,
    speed: Math.floor(Math.random() * (baseMax - baseMin + 1)) + baseMin
  };
}

function generateAbility(rarity) {
  const abilities = {
    legendary: [
      { name: 'Godlike Power', description: 'Massively increases all stats', effect: 'stat_boost_all_large' },
      { name: 'Ultimate Attack', description: 'Deals massive damage to opponent', effect: 'damage_large' },
      { name: 'Divine Shield', description: 'Blocks a large amount of damage', effect: 'shield_large' },
      { name: 'Celestial Blessing', description: 'Restores health and increases all stats', effect: 'heal_and_boost' },
      { name: 'Final Form', description: 'Transforms to gain massive power', effect: 'transform_power_up' }
    ],
    epic: [
      { name: 'Power Surge', description: 'Greatly increases attack stat', effect: 'stat_boost_attack_medium' },
      { name: 'Fortify', description: 'Greatly increases defense stat', effect: 'stat_boost_defense_medium' },
      { name: 'Swift Strike', description: 'Deals damage and increases speed', effect: 'damage_speed_boost' },
      { name: 'Critical Strike', description: 'High chance of critical hit', effect: 'critical_boost' },
      { name: 'Tactical Advantage', description: 'Increases effectiveness against specific types', effect: 'type_advantage' }
    ],
    rare: [
      { name: 'Heavy Strike', description: 'Deals extra damage to opponent', effect: 'damage_medium' },
      { name: 'Defensive Stance', description: 'Increases defense for two turns', effect: 'stat_boost_defense_small_duration' },
      { name: 'Quick Attack', description: 'Attacks first with increased speed', effect: 'speed_boost_attack' },
      { name: 'Healing Touch', description: 'Restores some health', effect: 'heal_medium' },
      { name: 'Disruptive Strike', description: 'Lowers opponent\'s attack', effect: 'lower_opponent_attack' }
    ],
    uncommon: [
      { name: 'Power Up', description: 'Slightly increases attack stat', effect: 'stat_boost_attack_small' },
      { name: 'Guard', description: 'Slightly increases defense stat', effect: 'stat_boost_defense_small' },
      { name: 'Focus', description: 'Slightly increases all stats', effect: 'stat_boost_all_small' },
      { name: 'First Aid', description: 'Restores a small amount of health', effect: 'heal_small' },
      { name: 'Tactical Retreat', description: 'Increases chance to dodge next attack', effect: 'dodge_chance_up' }
    ],
    common: [
      { name: 'Basic Attack', description: 'Deals damage to opponent', effect: 'damage_small' },
      { name: 'Defend', description: 'Reduces damage taken', effect: 'damage_reduction_small' },
      { name: 'Quick Step', description: 'Slightly increases speed', effect: 'stat_boost_speed_small' },
      { name: 'Determination', description: 'Small chance to survive a fatal hit', effect: 'survive_fatal_small' },
      { name: 'Teamwork', description: 'Slightly boosts ally\'s stats', effect: 'boost_ally_small' }
    ]
  };
  
  const abilityList = abilities[rarity];
  return abilityList[Math.floor(Math.random() * abilityList.length)];
}

function getSpawnRateByRarity(rarity) {
  switch (rarity) {
    case 'legendary': return 1;
    case 'epic': return 3;
    case 'rare': return 7;
    case 'uncommon': return 15;
    case 'common': return 25;
    default: return 10;
  }
}

// Run the script
populateCards();