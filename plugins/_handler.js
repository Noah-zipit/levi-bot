const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const User = require('../database/models/user');
const { getUserIdFromJid } = require('../utils/jidUtils');

/**
 * Loads all plugin commands from the plugins directory
 * @param {Object} sock - WhatsApp socket connection
 * @returns {Object} - Map of command names to handlers
 */
function loadPlugins(sock) {
  const plugins = {};
  const pluginsDir = path.join(__dirname);
  
  try {
    const pluginFiles = fs.readdirSync(pluginsDir)
      .filter(file => file.endsWith('.js') && file !== '_handler.js');
      
    for (const file of pluginFiles) {
      try {
        const plugin = require(path.join(pluginsDir, file));
        if (plugin.name && plugin.execute) {
          plugins[plugin.name] = {
            ...plugin,
            execute: async (sock, message, args) => {
              try {
                // Improved extraction of user ID
                const userId = getUserIdFromJid(
                  message.key.participant || message.key.remoteJid
                );
                const userName = message.pushName || 'Scout';
                
                // Find or create user
                const user = await User.findOrCreate(userId, userName);
                
                // Track command usage
                await user.incrementCommand(plugin.name);
                
                // Execute the command
                return await plugin.execute(sock, message, args, user);
              } catch (error) {
                logger.error(`Error in command ${plugin.name}: ${error.message}`);
                throw error;
              }
            }
          };
          logger.info(`Loaded plugin: ${plugin.name}`);
        }
      } catch (error) {
        logger.error(`Failed to load plugin ${file}: ${error.message}`);
      }
    }
  } catch (error) {
    logger.error(`Error loading plugins: ${error.message}`);
  }
  
  return plugins;
}

module.exports = { loadPlugins };