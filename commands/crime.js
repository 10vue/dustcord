const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');  // Ensure the 'path' module is correctly imported

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crime')
    .setDescription('Commit a crime for money!'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const balancesPath = path.join(__dirname, '../data/balances.json');
    const crimeSuccessPath = path.join(__dirname, '../data/crimeOutcomes/crimeSuccess.json');
    const crimeFailPath = path.join(__dirname, '../data/crimeOutcomes/crimeFail.json');
    const crimeJackpotPath = path.join(__dirname, '../data/crimeOutcomes/crimeJackpot.json');
    const crimeCriticalFailPath = path.join(__dirname, '../data/crimeOutcomes/crimeCriticalFail.json');

    // Read balances and crime documents
    let balances = {};
    let crimeSuccessMessages = [];
    let crimeFailMessages = [];
    let crimeJackpotMessages = [];
    let crimeCriticalFailMessages = [];
    try {
      balances = JSON.parse(fs.readFileSync(balancesPath));
      crimeSuccessMessages = JSON.parse(fs.readFileSync(crimeSuccessPath));
      crimeFailMessages = JSON.parse(fs.readFileSync(crimeFailPath));
      crimeJackpotMessages = JSON.parse(fs.readFileSync(crimeJackpotPath));
      crimeCriticalFailMessages = JSON.parse(fs.readFileSync(crimeCriticalFailPath));
    } catch (error) {
      console.error('[ERROR] Error reading data files:', error);
    }

    // Default balance for the user if none exists
    if (!balances[userId]) {
      balances[userId] = 0;
    }

    // Generate random outcome
    const randomChance = Math.random(); // Random number between 0 and 1

    let responseMessage = '';
    let rewardAmount = 0;
    let embedColor = '#ffffff';  // Default to neutral color (white)

    if (randomChance <= 0.01) {
      // Jackpot (1% chance)
      rewardAmount = Math.floor(Math.random() * (120000 - 80000 + 1)) + 80000; // Random between 80,000 and 120,000
      balances[userId] += rewardAmount;

      const jackpotMessage = crimeJackpotMessages[Math.floor(Math.random() * crimeJackpotMessages.length)];
      responseMessage = jackpotMessage.replace('{{amount}}', rewardAmount); // Replace the variable with the actual amount
      embedColor = '#e3c207';  // Updated to yellow for jackpot

      console.log(`[JACKPOT] ${interaction.user.tag} earned ${rewardAmount} coins from a jackpot.`);
    } else if (randomChance <= 0.20) {
      // Success (19% chance)
      rewardAmount = Math.floor(Math.random() * (3000 - 1500 + 1)) + 1500; // Random between 1,500 and 3,000
      balances[userId] += rewardAmount;

      const successMessage = crimeSuccessMessages[Math.floor(Math.random() * crimeSuccessMessages.length)];
      responseMessage = successMessage.replace('{{amount}}', rewardAmount); // Replace the variable with the actual amount
      embedColor = '#02ba11';  // Positive outcome (green)

      console.log(`[SUCCESS] ${interaction.user.tag} earned ${rewardAmount} coins from a successful crime.`);
    } else if (randomChance <= 0.23) {
      // Critical Failure (3% chance)
      const criticalFailMessage = crimeCriticalFailMessages[Math.floor(Math.random() * crimeCriticalFailMessages.length)];

      // Critical failure means losing between 50% and 75% of the balance
      const lossPercentage = Math.random() * (0.75 - 0.50) + 0.50; // Random between 50% and 75%
      const lossAmount = Math.floor(balances[userId] * lossPercentage);
      balances[userId] -= lossAmount;

      responseMessage = criticalFailMessage.replace('{{amount}}', lossAmount);
      embedColor = '#ba0230';  // Negative outcome (red)
      console.log(`[CRITICAL FAILURE] ${interaction.user.tag} lost ${lossAmount} coins due to a critical failure.`);
    } else {
      // Failure (77% chance)
      const lossPercentage = Math.random() * (0.45 - 0.35) + 0.35; // Random between 35% and 45%
      const lossAmount = Math.floor(balances[userId] * lossPercentage);
      balances[userId] -= lossAmount;

      const failMessage = crimeFailMessages[Math.floor(Math.random() * crimeFailMessages.length)];
      responseMessage = failMessage.replace('{{amount}}', lossAmount); // Replace the variable with the actual amount
      embedColor = '#ba0230';  // Negative outcome (red)

      console.log(`[FAILURE] ${interaction.user.tag} lost ${lossAmount} coins due to failure.`);
    }

    // Save the updated balances
    try {
      fs.writeFileSync(balancesPath, JSON.stringify(balances, null, 2));
    } catch (error) {
      console.error('[ERROR] Error saving balances file:', error);
    }

    // Create the embed response
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setDescription(responseMessage)
      .setTimestamp()
      .setFooter({ text: `Your new balance: ${balances[userId]} coins` });

    // Send the embed response
    await interaction.reply({ embeds: [embed] });
  },
};
