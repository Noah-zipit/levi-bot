// exportSession.js
const fs = require('fs');
const { useMultiFileAuthState } = require('baileys');

async function exportSession() {
  try {
    // Read auth data from your existing auth folder
    const { state } = await useMultiFileAuthState('./auth_info_baileys');
    
    if (!state || !state.creds) {
      console.error('No valid session found in auth_info_baileys folder');
      return;
    }
    
    // Convert auth data to JSON string
    const sessionJSON = JSON.stringify(state.creds);
    
    // Base64 encode it
    const sessionData = Buffer.from(sessionJSON).toString('base64');
    
    // Save to a file
    fs.writeFileSync('./session.txt', sessionData);
    
    console.log('Session exported successfully to session.txt');
    console.log('Add this string as SESSION_DATA in your Railway environment variables');
  } catch (error) {
    console.error('Error exporting session:', error);
  }
}

exportSession();
