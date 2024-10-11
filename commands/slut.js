const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slut')
    .setDescription('Try your luck for coins!'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const balancesPath = path.join(__dirname, '../data/balances.json');
    const slutSuccessPath = path.join(__dirname, '../data/slutOutcomes/slutSuccess.json');
    const slutMediocrePath = path.join(__dirname, '../data/slutOutcomes/slutMediocre.json');
    const slutUnattractivePath = path.join(__dirname, '../data/slutOutcomes/slutUnattractive.json');
    const slutCaughtPath = path.join(__dirname, '../data/slutOutcomes/slutCaught.json');

    // Read the balances and outcome JSON files
    let balances = {};
    let slutSuccessMessages = [];
    let slutMediocreMessages = [];
    let slutUnattractiveMessages = [];
    let slutCaughtMessages = [];

    try {
      balances = JSON.parse(fs.readFileSync(balancesPath));
      slutSuccessMessages = JSON.parse(fs.readFileSync(slutSuccessPath));
      slutMediocreMessages = JSON.parse(fs.readFileSync(slutMediocrePath));
      slutUnattractiveMessages = JSON.parse(fs.readFileSync(slutUnattractivePath));
      slutCaughtMessages = JSON.parse(fs.readFileSync(slutCaughtPath));
    } catch (error) {
      console.error('[ERROR] Error reading data files:', error);
    }

    // Default balance for the user if none exists
    if (!balances[userId]) {
      balances[userId] = 0;
    }

    // Generate random outcome based on probabilities
    const randomChance = Math.random();

    let responseMessage = '';
    let rewardAmount = 0;
    let embedColor = '#ffffff';  // Default neutral color

    // Success (40% chance)
    if (randomChance <= 0.40) {
      rewardAmount = Math.floor(Math.random() * (1500 - 500 + 1)) + 500; // Random between 500 and 1500
      balances[userId] += rewardAmount;

      const successMessage = slutSuccessMessages[Math.floor(Math.random() * slutSuccessMessages.length)];
      responseMessage = successMessage.replace('{{amount}}', rewardAmount); // Replace {{amount}} with actual coins earned
      embedColor = '#02ba11';  // Green for success
    } 
    // Mediocre (30% chance)
    else if (randomChance <= 0.70) {
      rewardAmount = Math.floor(Math.random() * (100 - 10 + 1)) + 10; // Random between 10 and 100
      balances[userId] += rewardAmount;

      const mediocreMessage = slutMediocreMessages[Math.floor(Math.random() * slutMediocreMessages.length)];
      responseMessage = mediocreMessage.replace('{{amount}}', rewardAmount); // Replace {{amount}} with actual coins earned
      embedColor = '#f4c542';  // Yellow for mediocre outcome
    }
    // Caught (20% chance)
    else if (randomChance <= 0.90) {
      const lossPercentage = Math.random() * (0.10 - 0.05) + 0.05; // Random between 5% and 10% loss
      const lossAmount = Math.floor(balances[userId] * lossPercentage);
      balances[userId] -= lossAmount;

      const caughtMessage = slutCaughtMessages[Math.floor(Math.random() * slutCaughtMessages.length)];
      responseMessage = caughtMessage.replace('{{amount}}', lossAmount); // Replace {{amount}} with actual coins lost
      embedColor = '#ba0230';  // Red for caught (loss)
    }
    // Unattractive (10% chance)
    else {
      const unattractiveMessage = slutUnattractiveMessages[Math.floor(Math.random() * slutUnattractiveMessages.length)];
      responseMessage = unattractiveMessage;
      embedColor = '#000000';  // Black for unattractive (no coins involved)
    }

    // Save the updated balance
    try {
      fs.writeFileSync(balancesPath, JSON.stringify(balances, null, 2));
    } catch (error) {
      console.error('[ERROR] Error saving balances file:', error);
    }

    // Create embed with the response message and the corresponding color
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setDescription(responseMessage)
      .setTimestamp()
      .setFooter({ text: `Your new balance: ${balances[userId]} coins` });  // Add footer showing new balance

    // Send the final response as an embed
    await interaction.reply({ embeds: [embed] });
  },
};
