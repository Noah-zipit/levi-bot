// plugins/bratify.js
const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'bratify',
  description: 'Convert text to bratty style',
  category: 'Fun',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    
    // Check if there's text to bratify
    let text = args.join(' ');
    
    // If no text provided, check if replying to a message
    if (!text && message.message.extendedTextMessage?.contextInfo?.quotedMessage) {
      const quotedMessage = message.message.extendedTextMessage.contextInfo.quotedMessage;
      text = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
    }
    
    if (!text) {
      await sock.sendMessage(sender, {
        text: formatMessage("Please provide text to bratify or reply to a message!")
      });
      return;
    }
    
    try {
      // Bratify the text
      const bratifiedText = applyBratStyle(text);
      
      // Send the bratified text
      await sock.sendMessage(sender, {
        text: formatMessage(bratifiedText)
      });
      
    } catch (error) {
      console.error('Error bratifying text:', error);
      await sock.sendMessage(sender, {
        text: formatMessage("There was an error bratifying your text. Please try again.")
      });
    }
  }
};

// Apply brat style to text
function applyBratStyle(text) {
  // Pick a random bratify style
  const styleIndex = Math.floor(Math.random() * 5);
  
  switch (styleIndex) {
    case 0:
      return alternatingCaps(text);
    case 1:
      return addBratEmojis(text);
    case 2:
      return babyCaps(text);
    case 3:
      return uwuify(text);
    case 4:
      return dramaticBratify(text);
    default:
      return alternatingCaps(text);
  }
}

// Alternating uppercase and lowercase letters
function alternatingCaps(text) {
  return text.split('').map((char, i) => 
    i % 2 === 0 ? char.toUpperCase() : char.toLowerCase()
  ).join('');
}

// Add brat emojis
function addBratEmojis(text) {
  const bratEmojis = ['💅', '✨', '💁‍♀️', '💋', '👑', '🙄', '😒', '💞', '💖', '💯'];
  
  // Add emojis at the beginning and end
  const startEmojis = getRandomEmojis(bratEmojis, Math.floor(Math.random() * 3) + 1).join('');
  const endEmojis = getRandomEmojis(bratEmojis, Math.floor(Math.random() * 3) + 1).join('');
  
  // Add emojis between words occasionally
  const words = text.split(' ');
  const bratifiedWords = words.map((word, i) => {
    if (i > 0 && Math.random() < 0.3) {
      const emoji = bratEmojis[Math.floor(Math.random() * bratEmojis.length)];
      return `${emoji} ${word}`;
    }
    return word;
  });
  
  return `${startEmojis} ${bratifiedWords.join(' ')} ${endEmojis}`;
}

// Baby-like caps (like WhEn i Do ThIs)
function babyCaps(text) {
  return text.split(' ').map(word => {
    if (word.length <= 2) return word;
    
    return word.split('').map((char, i) => {
      if (i === 0) return char.toUpperCase();
      if (i % 2 === 0 && Math.random() < 0.7) return char.toUpperCase();
      return char.toLowerCase();
    }).join('');
  }).join(' ');
}

// UwU-ify text
function uwuify(text) {
  let result = text.toLowerCase()
    .replace(/r|l/g, 'w')
    .replace(/th/g, 'd')
    .replace(/ove/g, 'uv')
    .replace(/n([aeiou])/g, 'ny$1');
  
  // Randomly add "~" at the end of some words
  const words = result.split(' ');
  const uwuWords = words.map(word => {
    if (Math.random() < 0.3 && word.length > 2) {
      return word + '~';
    }
    return word;
  });
  
  // Add UwU-related emoji
  const uwuEmojis = ['(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', '(◕‿◕)', '(. ❛ ᴗ ❛.)', '(づ｡◕‿‿◕｡)づ', 'UwU', 'OwO', '>w<'];
  const emoji = uwuEmojis[Math.floor(Math.random() * uwuEmojis.length)];
  
  return `${uwuWords.join(' ')} ${emoji}`;
}

// Dramatic bratify with extra punctuation and emphasis
function dramaticBratify(text) {
  // Add emphasis
  let result = text.replace(/\b(?:i|me|my|mine)\b/gi, match => match.toUpperCase());
  
  // Add extra punctuation
  result = result.replace(/\./g, '...');
  result = result.replace(/\?/g, '???');
  result = result.replace(/!/g, '!!!');
  
  // Add dramatic emphasis
  const words = result.split(' ');
  const dramaticWords = words.map(word => {
    if (Math.random() < 0.2 && word.length > 3) {
      return word.toUpperCase();
    }
    return word;
  });
  
  // Add dramatic emoji
  const dramaticEmojis = ['🙄', '💅', '🤦‍♀️', '😤', '😒', '✋', '👏', '💯'];
  const startEmojis = getRandomEmojis(dramaticEmojis, 1).join('');
  const endEmojis = getRandomEmojis(dramaticEmojis, 2).join(' ');
  
  return `${startEmojis} ${dramaticWords.join(' ')} ${endEmojis}`;
}

// Helper: Get random emojis from a list
function getRandomEmojis(emojiList, count) {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(emojiList[Math.floor(Math.random() * emojiList.length)]);
  }
  return result;
}