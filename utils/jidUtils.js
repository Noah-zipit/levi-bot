// utils/jidUtils.js

/**
 * Formats a JID (Jabber ID) consistently for display and comparison
 * @param {string} jid - The WhatsApp JID or user ID
 * @returns {string} - Formatted JID
 */
function formatJid(jid) {
  if (!jid) return '';
  
  // If it already has @s.whatsapp.net or @g.us, return as is
  if (jid.includes('@s.whatsapp.net') || jid.includes('@g.us')) {
    return jid;
  }
  
  // Remove any existing suffixes if present
  const cleanId = jid.split('@')[0];
  
  // Add proper suffix
  return `${cleanId}@s.whatsapp.net`;
}

/**
 * Extracts the user ID from a JID without the domain part
 * @param {string} jid - The WhatsApp JID
 * @returns {string} - User ID portion
 */
function getUserIdFromJid(jid) {
  if (!jid) return '';
  return jid.split('@')[0];
}

/**
 * Checks if a string looks like a proper international phone number
 * @param {string} id - ID to check
 * @returns {boolean} - True if it's likely a phone number
 */
function isLikelyPhoneNumber(id) {
  // Most international phone numbers are 7-15 digits and often start with country code
  // Common patterns: +1XXXXXXXXXX, 1XXXXXXXXXX, etc.
  return /^(\+)?[1-9]\d{6,14}$/.test(id);
}

/**
 * Formats a JID for display in messages with proper formatting
 * @param {string} jid - The WhatsApp JID
 * @param {string} name - Optional user name
 * @returns {string} - Display format
 */
function formatJidForDisplay(jid, name = '') {
  const userId = getUserIdFromJid(jid);
  
  // Return name if provided and different from ID
  if (name && name !== userId) {
    return name;
  }
  
  // For phone numbers, add + if it looks like an international number
  if (isLikelyPhoneNumber(userId)) {
    return userId.startsWith('+') ? userId : `+${userId}`;
  }
  
  // For WhatsApp IDs and usernames, add @ prefix
  return `@${userId}`;
}

/**
 * Checks if a user is the bot owner
 * @param {string} jid - The user's JID or ID
 * @param {string} ownerNumber - The owner's number from config
 * @returns {boolean} - True if user is owner
 */
function isOwner(jid, ownerNumber) {
  const userId = getUserIdFromJid(jid);
  return userId === ownerNumber;
}

module.exports = {
  formatJid,
  getUserIdFromJid,
  formatJidForDisplay,
  isOwner,
  isLikelyPhoneNumber
};