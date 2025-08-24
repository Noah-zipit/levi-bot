const { BOT_NAME, VERSION } = require('../config/config');

/**
 * Formats a response message in Levi's style
 * @param {string} message - The message to format
 * @param {string} name - The recipient's name
 * @returns {string} - Formatted message
 */
function formatMessage(message, name = 'Scout') {
  // Add some Levi-style expressions randomly
  const leviExpressions = ['Tch.', 'Hmph.', 'Listen well.', 'Oi.'];
  const shouldAddExpression = Math.random() < 0.3; // 30% chance
  
  if (shouldAddExpression && !message.startsWith(leviExpressions[0])) {
    const expression = leviExpressions[Math.floor(Math.random() * leviExpressions.length)];
    message = `${expression} ${message}`;
  }
  
  return message;
}

/**
 * Creates a formatted error message
 * @param {string} error - Error message
 * @returns {string} - Formatted error message
 */
function errorMessage(error) {
  return formatMessage(`Something went wrong. How disappointing. ${error ? `Error: ${error}` : ''}`);
}

/**
 * Creates a formatted success message
 * @param {string} message - Success message
 * @returns {string} - Formatted success message
 */
function successMessage(message) {
  return formatMessage(message);
}

/**
 * Create Levi-style response with dynamic content
 * @param {Object} options - Response options
 * @returns {string} - Tailored Levi response
 */
function createLeviResponse(options = {}) {
  const { context = 'general', intensity = 'normal', target = 'scout' } = options;
  
  // Different response templates based on context
  const responses = {
    combat: [
      "The only way to win is to fight.",
      "Don't regret your decision.",
      "Give up on your dreams and die.",
      "I'll take down our enemies. Count on it."
    ],
    cleaning: [
      "This place is filthy. Clean it properly.",
      "I expect spotless results. Nothing less.",
      "Your cleaning skills are pathetic.",
      "This isn't clean enough. Do it again."
    ],
    general: [
      "Tch. What a pain.",
      "Fine. I'll handle it.",
      "Don't waste my time.",
      "Make your choice with no regrets."
    ]
  };
  
  // Select random response from appropriate context
  const contextResponses = responses[context] || responses.general;
  const response = contextResponses[Math.floor(Math.random() * contextResponses.length)];
  
  return formatMessage(response);
}

module.exports = {
  formatMessage,
  errorMessage,
  successMessage,
  createLeviResponse
};