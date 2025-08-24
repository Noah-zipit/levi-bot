// plugins/group.js
const { formatMessage } = require('../utils/messages');
const { isOwner } = require('../utils/jidUtils');
const { OWNER_NUMBER } = require('../config/config');

module.exports = {
  name: 'group',
  description: 'Manage group settings and actions',
  category: 'Admin',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userId = message.key.participant || sender.split('@')[0];
    
    // Check if used in a group
    if (!sender.endsWith('@g.us')) {
      await sock.sendMessage(sender, {
        text: formatMessage("This command can only be used in groups.")
      });
      return;
    }
    
    // Check if user is admin or bot owner
    const isAdmin = await isGroupAdmin(sock, sender, userId);
    const botOwner = isOwner(userId, OWNER_NUMBER);
    
    if (!isAdmin && !botOwner) {
      await sock.sendMessage(sender, {
        text: formatMessage("You need to be a group admin to use this command.")
      });
      return;
    }
    
    if (!args.length) {
      await sock.sendMessage(sender, {
        text: formatMessage(
          "🛠️ *GROUP MANAGEMENT* 🛠️\n\n" +
          "Usage: !group <command> [options]\n\n" +
          "Available commands:\n" +
          "• tagall - Tag all members\n" +
          "• hidetag - Tag all members invisibly\n" +
          "• broadcast - Send a message to all members\n" +
          "• kick - Remove a user from the group\n" +
          "• add - Add a user to the group\n" +
          "• promote - Make a user admin\n" +
          "• demote - Remove admin from a user\n" +
          "• close - Only admins can send messages\n" +
          "• open - Everyone can send messages\n" +
          "• subject - Change group name\n" +
          "• desc - Change group description\n" +
          "• info - Show group information\n" +
          "• link - Get group invite link\n\n" +
          "Example: !group tagall Hello everyone!"
        )
      });
      return;
    }
    
    const command = args[0].toLowerCase();
    const commandArgs = args.slice(1);
    
    try {
      switch (command) {
        case 'tagall':
          await handleTagAll(sock, message, commandArgs, false);
          break;
          
        case 'hidetag':
          await handleTagAll(sock, message, commandArgs, true);
          break;
          
        case 'broadcast':
          await handleBroadcast(sock, message, commandArgs);
          break;
          
        case 'kick':
          await handleKick(sock, message, commandArgs);
          break;
          
        case 'add':
          await handleAdd(sock, message, commandArgs);
          break;
          
        case 'promote':
          await handlePromote(sock, message, commandArgs);
          break;
          
        case 'demote':
          await handleDemote(sock, message, commandArgs);
          break;
          
        case 'close':
          await handleGroupSettings(sock, message, true);
          break;
          
        case 'open':
          await handleGroupSettings(sock, message, false);
          break;
          
        case 'subject':
          await handleChangeSubject(sock, message, commandArgs);
          break;
          
        case 'desc':
          await handleChangeDescription(sock, message, commandArgs);
          break;
          
        case 'info':
          await handleGroupInfo(sock, message);
          break;
          
        case 'link':
          await handleGroupLink(sock, message);
          break;
          
        default:
          await sock.sendMessage(sender, {
            text: formatMessage(`Unknown group command: ${command}`)
          });
      }
    } catch (error) {
      console.error(`Error in group command: ${error.message}`);
      await sock.sendMessage(sender, {
        text: formatMessage(`Error executing command: ${error.message}`)
      });
    }
  }
};

// Helper function to check if user is group admin
async function isGroupAdmin(sock, groupJid, userId) {
  try {
    const groupMetadata = await sock.groupMetadata(groupJid);
    const participant = groupMetadata.participants.find(p => p.id.split('@')[0] === userId);
    return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

// Handle tag all members
async function handleTagAll(sock, message, args, hidden = false) {
  const groupId = message.key.remoteJid;
  
  try {
    // Get group metadata
    const groupMetadata = await sock.groupMetadata(groupId);
    const participants = groupMetadata.participants;
    
    // Create message text
    const text = args.length > 0 ? args.join(' ') : 'Hello everyone!';
    
    if (hidden) {
      // Hidden tag - message shows without visible tags but still notifies everyone
      await sock.sendMessage(groupId, {
        text: formatMessage(text),
        mentions: participants.map(p => p.id)
      });
    } else {
      // Regular tag all - create a message that tags everyone visibly
      let tagMessage = `${text}\n\n`;
      
      participants.forEach((participant, i) => {
        tagMessage += `@${participant.id.split('@')[0]}`;
        
        // Add newline every 3 tags or at the end
        tagMessage += (i + 1) % 3 === 0 || i === participants.length - 1 ? '\n' : ' ';
      });
      
      await sock.sendMessage(groupId, {
        text: formatMessage(tagMessage),
        mentions: participants.map(p => p.id)
      });
    }
  } catch (error) {
    console.error('Error tagging members:', error);
    await sock.sendMessage(groupId, {
      text: formatMessage("Error tagging members.")
    });
  }
}

// Handle broadcast to group
async function handleBroadcast(sock, message, args) {
  const groupId = message.key.remoteJid;
  
  if (args.length === 0) {
    await sock.sendMessage(groupId, {
      text: formatMessage("Please provide a message to broadcast.")
    });
    return;
  }
  
  try {
    // Get group metadata
    const groupMetadata = await sock.groupMetadata(groupId);
    const participants = groupMetadata.participants;
    
    // Create message text
    const broadcastMessage = args.join(' ');
    
    // Format broadcast message
    const formattedMessage = 
      `📢 *GROUP BROADCAST* 📢\n\n` +
      `${broadcastMessage}\n\n` +
      `From: Admin`;
    
    // Send to group with everyone tagged (for notifications)
    await sock.sendMessage(groupId, {
      text: formatMessage(formattedMessage),
      mentions: participants.map(p => p.id)
    });
  } catch (error) {
    console.error('Error broadcasting message:', error);
    await sock.sendMessage(groupId, {
      text: formatMessage("Error broadcasting message.")
    });
  }
}

// Handle kicking a user
async function handleKick(sock, message, args) {
  const groupId = message.key.remoteJid;
  
  // Check if a user is mentioned
  if (!message.message.extendedTextMessage || 
      !message.message.extendedTextMessage.contextInfo || 
      !message.message.extendedTextMessage.contextInfo.mentionedJid ||
      message.message.extendedTextMessage.contextInfo.mentionedJid.length === 0) {
    await sock.sendMessage(groupId, {
      text: formatMessage("You need to @mention the user you want to remove.")
    });
    return;
  }
  
  const targetJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
  const targetId = targetJid.split('@')[0];
  
  try {
    // Confirm action
    await sock.sendMessage(groupId, {
      text: formatMessage(`Removing @${targetId} from the group...`),
      mentions: [targetJid]
    });
    
    // Remove the user
    await sock.groupParticipantsUpdate(
      groupId,
      [targetJid],
      "remove"
    );
    
    await sock.sendMessage(groupId, {
      text: formatMessage(`@${targetId} has been removed from the group.`),
      mentions: [targetJid]
    });
  } catch (error) {
    console.error('Error removing user:', error);
    await sock.sendMessage(groupId, {
      text: formatMessage("Error removing user. Make sure the bot is an admin and has permission to remove members.")
    });
  }
}

// Handle adding a user
async function handleAdd(sock, message, args) {
  const groupId = message.key.remoteJid;
  
  if (args.length === 0) {
    await sock.sendMessage(groupId, {
      text: formatMessage("Please provide a phone number to add (international format, e.g., +1234567890).")
    });
    return;
  }
  
  let phoneNumber = args[0];
  
  // Format phone number
  if (!phoneNumber.startsWith('+')) {
    phoneNumber = '+' + phoneNumber;
  }
  
  // Remove any spaces or dashes
  phoneNumber = phoneNumber.replace(/[\s-]/g, '');
  
  // Create JID
  const targetJid = phoneNumber.replace('+', '') + '@s.whatsapp.net';
  
  try {
    // Check if the number exists on WhatsApp
    const [result] = await sock.onWhatsApp(targetJid);
    
    if (!result || !result.exists) {
      await sock.sendMessage(groupId, {
        text: formatMessage("This number doesn't exist on WhatsApp.")
      });
      return;
    }
    
    // Add the user
    await sock.groupParticipantsUpdate(
      groupId,
      [targetJid],
      "add"
    );
    
    await sock.sendMessage(groupId, {
      text: formatMessage(`${phoneNumber} has been added to the group.`)
    });
  } catch (error) {
    console.error('Error adding user:', error);
    await sock.sendMessage(groupId, {
      text: formatMessage(`Error adding user: ${error.message}. Make sure the bot is an admin and has permission to add members.`)
    });
  }
}

// Handle promoting a user to admin
async function handlePromote(sock, message, args) {
  const groupId = message.key.remoteJid;
  
  // Check if a user is mentioned
  if (!message.message.extendedTextMessage || 
      !message.message.extendedTextMessage.contextInfo || 
      !message.message.extendedTextMessage.contextInfo.mentionedJid ||
      message.message.extendedTextMessage.contextInfo.mentionedJid.length === 0) {
    await sock.sendMessage(groupId, {
      text: formatMessage("You need to @mention the user you want to promote.")
    });
    return;
  }
  
  const targetJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
  const targetId = targetJid.split('@')[0];
  
  try {
    // Promote the user
    await sock.groupParticipantsUpdate(
      groupId,
      [targetJid],
      "promote"
    );
    
    await sock.sendMessage(groupId, {
      text: formatMessage(`@${targetId} has been promoted to admin.`),
      mentions: [targetJid]
    });
  } catch (error) {
    console.error('Error promoting user:', error);
    await sock.sendMessage(groupId, {
      text: formatMessage("Error promoting user. Make sure the bot is an admin.")
    });
  }
}

// Handle demoting an admin
async function handleDemote(sock, message, args) {
  const groupId = message.key.remoteJid;
  
  // Check if a user is mentioned
  if (!message.message.extendedTextMessage || 
      !message.message.extendedTextMessage.contextInfo || 
      !message.message.extendedTextMessage.contextInfo.mentionedJid ||
      message.message.extendedTextMessage.contextInfo.mentionedJid.length === 0) {
    await sock.sendMessage(groupId, {
      text: formatMessage("You need to @mention the admin you want to demote.")
    });
    return;
  }
  
  const targetJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
  const targetId = targetJid.split('@')[0];
  
  try {
    // Demote the user
    await sock.groupParticipantsUpdate(
      groupId,
      [targetJid],
      "demote"
    );
    
    await sock.sendMessage(groupId, {
      text: formatMessage(`@${targetId} has been demoted from admin.`),
      mentions: [targetJid]
    });
  } catch (error) {
    console.error('Error demoting user:', error);
    await sock.sendMessage(groupId, {
      text: formatMessage("Error demoting user. Make sure the bot is an admin.")
    });
  }
}

// Handle open/close group (only admins can send messages)
async function handleGroupSettings(sock, message, isClose) {
  const groupId = message.key.remoteJid;
  
  try {
    // Update group settings
    await sock.groupSettingUpdate(
      groupId,
      isClose ? 'announcement' : 'not_announcement'
    );
    
    await sock.sendMessage(groupId, {
      text: formatMessage(isClose 
        ? "Group has been closed. Only admins can send messages now."
        : "Group has been opened. Everyone can send messages.")
    });
  } catch (error) {
    console.error('Error updating group settings:', error);
    await sock.sendMessage(groupId, {
      text: formatMessage("Error updating group settings. Make sure the bot is an admin.")
    });
  }
}

// Handle changing group subject
async function handleChangeSubject(sock, message, args) {
  const groupId = message.key.remoteJid;
  
  if (args.length === 0) {
    await sock.sendMessage(groupId, {
      text: formatMessage("Please provide a new group name.")
    });
    return;
  }
  
  const newSubject = args.join(' ');
  
  try {
    // Update group subject
    await sock.groupUpdateSubject(groupId, newSubject);
    
    await sock.sendMessage(groupId, {
      text: formatMessage(`Group name has been changed to "${newSubject}".`)
    });
  } catch (error) {
    console.error('Error changing group name:', error);
    await sock.sendMessage(groupId, {
      text: formatMessage("Error changing group name. Make sure the bot is an admin.")
    });
  }
}

// Handle changing group description
async function handleChangeDescription(sock, message, args) {
  const groupId = message.key.remoteJid;
  
  if (args.length === 0) {
    await sock.sendMessage(groupId, {
      text: formatMessage("Please provide a new group description.")
    });
    return;
  }
  
  const newDescription = args.join(' ');
  
  try {
    // Update group description
    await sock.groupUpdateDescription(groupId, newDescription);
    
    await sock.sendMessage(groupId, {
      text: formatMessage("Group description has been updated.")
    });
  } catch (error) {
    console.error('Error changing group description:', error);
    await sock.sendMessage(groupId, {
      text: formatMessage("Error changing group description. Make sure the bot is an admin.")
    });
  }
}

// Handle getting group info
async function handleGroupInfo(sock, message) {
  const groupId = message.key.remoteJid;
  
  try {
    // Get group metadata
    const groupMetadata = await sock.groupMetadata(groupId);
    
    // Count admins and members
    const admins = groupMetadata.participants.filter(p => p.admin).length;
    const members = groupMetadata.participants.length;
    
    // Format creation date
    const createdAt = new Date(groupMetadata.creation * 1000);
    const formattedDate = createdAt.toLocaleDateString();
    
    // Build info message
    let infoMessage = `ℹ️ *GROUP INFORMATION* ℹ️\n\n`;
    infoMessage += `*Name:* ${groupMetadata.subject}\n`;
    infoMessage += `*ID:* ${groupId.split('@')[0]}\n`;
    infoMessage += `*Created:* ${formattedDate}\n`;
    infoMessage += `*Members:* ${members}\n`;
    infoMessage += `*Admins:* ${admins}\n`;
    
    if (groupMetadata.desc) {
      infoMessage += `\n*Description:*\n${groupMetadata.desc}`;
    }
    
    await sock.sendMessage(groupId, {
      text: formatMessage(infoMessage)
    });
  } catch (error) {
    console.error('Error getting group info:', error);
    await sock.sendMessage(groupId, {
      text: formatMessage("Error getting group information.")
    });
  }
}

// Handle getting group invite link
async function handleGroupLink(sock, message) {
  const groupId = message.key.remoteJid;
  
  try {
    // Get group invite link
    const code = await sock.groupInviteCode(groupId);
    
    if (!code) {
      await sock.sendMessage(groupId, {
        text: formatMessage("Failed to get invite link. Make sure the bot is an admin.")
      });
      return;
    }
    
    const inviteLink = `https://chat.whatsapp.com/${code}`;
    
    await sock.sendMessage(groupId, {
      text: formatMessage(`🔗 *GROUP INVITE LINK*\n\n${inviteLink}`)
    });
  } catch (error) {
    console.error('Error getting group link:', error);
    await sock.sendMessage(groupId, {
      text: formatMessage("Error getting group invite link. Make sure the bot is an admin.")
    });
  }
}