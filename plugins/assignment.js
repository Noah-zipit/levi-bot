const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'assignment',
  description: 'Get a cleaning assignment from Captain Levi',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userName = message.pushName || 'Scout';
    
    // Check if user is in the Scout Regiment
    if (!user.scoutRegiment) {
      await sock.sendMessage(sender, {
        text: formatMessage(`You need to join the Scout Regiment first. Use !join if you have the courage.`)
      });
      return;
    }
    
    // Generate random cleaning assignment
    const locations = [
      'headquarters main hall', 'cadet sleeping quarters', 'mess hall', 
      'stables', 'training grounds', 'equipment storage', 'officers quarters',
      'castle windows', 'kitchen', 'basement', 'Captain\'s office'
    ];
    
    const tasks = [
      'sweep and mop', 'dust thoroughly', 'scrub until spotless', 
      'polish to a shine', 'organize and clean', 'sanitize completely',
      'wash and dry', 'remove all cobwebs', 'clean every corner'
    ];
    
    const standards = [
      'I expect to be able to eat off those floors when you\'re done.',
      'If I find a speck of dust, you\'ll redo it all.',
      'Do it properly the first time, or do it twice.',
      'This is not just cleaning. This is discipline.',
      'Your life may depend on your attention to detail someday.',
      'I\'ll be inspecting your work personally.',
      'The state of your quarters reflects the state of your mind.'
    ];
    
    const location = locations[Math.floor(Math.random() * locations.length)];
    const task = tasks[Math.floor(Math.random() * tasks.length)];
    const standard = standards[Math.floor(Math.random() * standards.length)];
    
    // Create assignment message
    let assignmentMsg = `🧹 *CLEANING ASSIGNMENT* 🧹\n\n`;
    assignmentMsg += `${userName}, you are to ${task} the ${location}.\n\n`;
    assignmentMsg += `${standard}\n\n`;
    assignmentMsg += `${formatMessage("Get to it. Now.")}`;
    
    await sock.sendMessage(sender, { text: assignmentMsg });
    
    // Increase cleaning skill
    user.cleaningSkill += 2;
    await user.save();
  }
};