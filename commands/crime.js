const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');  // Ensure the 'path' module is correctly imported

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crime')
    .setDescription('Commit a crime for money!'),

  async execute(interaction) {
    await interaction.deferReply();
    const userId = interaction.user.id;
    const balancesPath = path.join(__dirname, '../data/balances.json');
    const crimeSuccessPath = path.join(__dirname, '../data/crimeOutcomes/crimeSuccess.json');
    const crimeFailPath = path.join(__dirname, '../data/crimeOutcomes/crimeFail.json');
    const crimeJackpotPath = path.join(__dirname, '../data/crimeOutcomes/crimeJackpot.json');
    const crimeCriticalFailPath = path.join(__dirname, '../data/crimeOutcomes/crimeCriticalFail.json');
    const lastCrimeTimesPath = path.join(__dirname, '../data/lastCrimeTimes.json');

    // Ensure the lastCrimeTimes.json file exists
    if (!fs.existsSync(lastCrimeTimesPath)) {
      fs.writeFileSync(lastCrimeTimesPath, JSON.stringify({}, null, 2)); // Create file with an empty object
    }

    // Read balances, crime documents, and last crime times
    let balances = {};
    let lastCrimeTimes = {};
    let crimeSuccessMessages = [];
    let crimeFailMessages = [];
    let crimeJackpotMessages = [];
    let crimeCriticalFailMessages = [];
    try {
      balances = JSON.parse(fs.readFileSync(balancesPath));
      lastCrimeTimes = JSON.parse(fs.readFileSync(lastCrimeTimesPath));
      crimeSuccessMessages = JSON.parse(fs.readFileSync(crimeSuccessPath));
      crimeFailMessages = JSON.parse(fs.readFileSync(crimeFailPath));
      crimeJackpotMessages = JSON.parse(fs.readFileSync(crimeJackpotPath));
      crimeCriticalFailMessages = JSON.parse(fs.readFileSync(crimeCriticalFailPath));
    } catch (error) {
      console.error('[ERROR] Error reading data files:', error);
    }

    // Default balance and last crime time for the user if none exist
    if (!balances[userId]) {
      balances[userId] = 0;
    }
    if (!lastCrimeTimes[userId]) {
      lastCrimeTimes[userId] = 0;
    }

    // Cooldown logic: one hour (3600000 milliseconds)
    const currentTime = Date.now();
    const oneHour = 3600000; // 1 hour in milliseconds
    const timeSinceLastCrime = currentTime - lastCrimeTimes[userId];

    if (timeSinceLastCrime < oneHour) {
      const timeRemaining = Math.ceil((oneHour - timeSinceLastCrime) / 60000); // Convert remaining time to minutes
      return interaction.editReply({
        content: `You need to wait ${timeRemaining} more minutes before committing another crime!`,
        ephemeral: true,
      });
    }

    // Update the last crime time
    lastCrimeTimes[userId] = currentTime;

    // Save the updated last crime times
    try {
      fs.writeFileSync(lastCrimeTimesPath, JSON.stringify(lastCrimeTimes, null, 2));
    } catch (error) {
      console.error('[ERROR] Error saving last crime times file:', error);
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

      console.log(`[JACKPOT] ${interaction.user.tag} earned ${rewardAmount} dustollarinos from a jackpot.`);
    } else if (randomChance <= 0.20) {
      // Success (19% chance)
      rewardAmount = Math.floor(Math.random() * (3000 - 1500 + 1)) + 1500; // Random between 1,500 and 3,000
      balances[userId] += rewardAmount;

      const successMessage = crimeSuccessMessages[Math.floor(Math.random() * crimeSuccessMessages.length)];
      responseMessage = successMessage.replace('{{amount}}', rewardAmount); // Replace the variable with the actual amount
      embedColor = '#02ba11';  // Positive outcome (green)

      console.log(`[SUCCESS] ${interaction.user.tag} earned ${rewardAmount} dustollarinos from a successful crime.`);
    } else if (randomChance <= 0.23) {
      // Critical Failure (3% chance)
      const criticalFailMessage = crimeCriticalFailMessages[Math.floor(Math.random() * crimeCriticalFailMessages.length)];

      // Critical failure means losing between 50% and 75% of the balance
      const lossPercentage = Math.random() * (0.75 - 0.50) + 0.50; // Random between 50% and 75%
      const lossAmount = Math.floor(balances[userId] * lossPercentage);
      balances[userId] -= lossAmount;

      responseMessage = criticalFailMessage.replace('{{amount}}', lossAmount);
      embedColor = '#ba0230';  // Negative outcome (red)
      console.log(`[CRITICAL FAILURE] ${interaction.user.tag} lost ${lossAmount} dustollarinos due to a critical failure.`);
    } else {
      // Failure (77% chance)
      const lossPercentage = Math.random() * (0.45 - 0.35) + 0.35; // Random between 35% and 45%
      const lossAmount = Math.floor(balances[userId] * lossPercentage);
      balances[userId] -= lossAmount;

      const failMessage = crimeFailMessages[Math.floor(Math.random() * crimeFailMessages.length)];
      responseMessage = failMessage.replace('{{amount}}', lossAmount); // Replace the variable with the actual amount
      embedColor = '#ba0230';  // Negative outcome (red)

      console.log(`[FAILURE] ${interaction.user.tag} lost ${lossAmount} dustollarinos due to failure.`);
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
      .setFooter({ text: `Your new balance: ${balances[userId]} dustollarinos` });

    // Send the embed response (use `editReply` after defer)
    await interaction.editReply({ embeds: [embed] });
  },
};
