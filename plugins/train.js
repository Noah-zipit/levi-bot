const { formatMessage } = require('../utils/messages');

module.exports = {
  name: 'train',
  description: 'Train in ODM gear and titan combat',
  async execute(sock, message, args, user) {
    const sender = message.key.remoteJid;
    const userName = message.pushName || 'Scout';
    
    // Check if user is in cooldown period
    const now = new Date();
    if (user.lastTraining && (now - new Date(user.lastTraining)) < 3600000) { // 1 hour cooldown
      const timeLeft = Math.ceil((3600000 - (now - new Date(user.lastTraining))) / 60000);
      await sock.sendMessage(sender, {
        text: formatMessage(`Rest for ${timeLeft} more minutes before training again. Even I need to rest sometimes.`)
      });
      return;
    }
    
    // Training scenarios
    const scenarios = [
      {
        name: 'ODM Gear Practice',
        description: 'Training with Omni-Directional Mobility Gear in the forest',
        success: 'Your movements are becoming more efficient. You wasted less gas than last time.',
        failure: 'You nearly crashed into a tree. Your reflexes need work.',
        skillGain: 2
      },
      {
        name: 'Titan Dummy Training',
        description: 'Practicing nape cutting techniques on wooden titan dummies',
        success: 'Your cuts are becoming deeper and more precise. Keep it up.',
        failure: 'Your cuts are too shallow. A real titan would have regenerated.',
        skillGain: 3
      },
      {
        name: 'Formation Riding',
        description: 'Practicing long-distance scouting formation on horseback',
        success: 'You maintained your position well. Your signals were clear.',
        failure: 'You broke formation twice. In a real mission, that would endanger your comrades.',
        skillGain: 1
      },
      {
        name: 'Endurance Training',
        description: 'Running laps around the headquarters with full gear',
        success: 'Your stamina is improving. You completed all laps at a consistent pace.',
        failure: 'Youre out of breath too quickly. How do you expect to fight titans like this?',
        skillGain: 2
      },
      {
        name: 'Cleaning Drill',
        description: 'Speed-cleaning the mess hall under Captain Levis supervision',
        success: 'Acceptable. You missed fewer spots than last time.',
        failure: 'Pathetic. I could still write my name in the dust.',
        skillGain: 3
      }
    ];
    
    // Select random scenario
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    
    // Determine success (70% chance)
    const success = Math.random() < 0.7;
    
    // Calculate skill gain based on success
    const skillGain = success ? scenario.skillGain : Math.ceil(scenario.skillGain / 2);
    
    // Update user stats
    user.lastTraining = now;
    user.trainingCount = (user.trainingCount || 0) + 1;
    user.cleaningSkill += skillGain;
    user.successfulTrainings = (user.successfulTrainings || 0) + (success ? 1 : 0);
    await user.save();
    
    // Create training result message
    let trainingMsg = `⚔️ *TRAINING SESSION: ${scenario.name}* ⚔️\n\n`;
    trainingMsg += `${scenario.description}\n\n`;
    trainingMsg += `*Result:* ${success ? '✅ Success' : '❌ Needs Improvement'}\n`;
    trainingMsg += `*Feedback:* ${success ? scenario.success : scenario.failure}\n`;
    trainingMsg += `*Skill gained:* +${skillGain} points\n\n`;
    
    // Add Levi's comment
    if (user.trainingCount % 5 === 0) {
      trainingMsg += `${formatMessage("You've completed " + user.trainingCount + " training sessions. " + 
                     (user.successfulTrainings / user.trainingCount > 0.7 ? 
                      "Your dedication is... not terrible." : 
                      "You need to take this more seriously if you want to survive."))}`;
    }
    
    await sock.sendMessage(sender, { text: trainingMsg });
  }
};