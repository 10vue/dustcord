const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');

// Crime outcomes data
const crimeSuccessMessages = require('../data/crimeOutcomes/crimeSuccess.json');
const crimeFailMessages = require('../data/crimeOutcomes/crimeFail.json');
const crimeJackpotMessages = require('../data/crimeOutcomes/crimeJackpot.json');
const crimeCriticalFailMessages = require('../data/crimeOutcomes/crimeCriticalFail.json');

// Load TIMEZONE from environment variables (Heroku config)
const TIMEZONE = process.env.TIMEZONE || 'UTC'; // Default to UTC if not set

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crime')
    .setDescription('Commit a crime for money!'),

  async execute(interaction, pgClient) {
    await interaction.deferReply();
    const userId = interaction.user.id;

    try {
      // Query user's balance from the database
      const balanceRes = await pgClient.query('SELECT balance FROM balances WHERE user_id = $1', [userId]);
      let userBalance = balanceRes.rows.length ? balanceRes.rows[0].balance : 0;

      // Query last crime time from the database
      const lastCrimeRes = await pgClient.query('SELECT last_crime_time FROM last_crime_times WHERE user_id = $1', [userId]);
      let lastCrimeTime = lastCrimeRes.rows.length ? lastCrimeRes.rows[0].last_crime_time : null;

      if (lastCrimeTime) {
        // Convert the last crime time from UTC to the specified TIMEZONE
        lastCrimeTime = moment(lastCrimeTime).tz(TIMEZONE).valueOf(); // Convert to timestamp in milliseconds
      } else {
        lastCrimeTime = 0; // No crime committed yet
      }

      // Cooldown logic: one hour (3600000 milliseconds)
      const currentTime = Date.now();
      const oneHour = 3600000; // 1 hour in milliseconds
      const timeSinceLastCrime = currentTime - lastCrimeTime;

      if (timeSinceLastCrime < oneHour) {
        const timeRemaining = Math.ceil((oneHour - timeSinceLastCrime) / 60000); // Convert remaining time to minutes
        return interaction.editReply({
          content: `You need to wait ${timeRemaining} more minutes before committing another crime!`,
          ephemeral: true,
        });
      }

      // Update the last crime time to the current time in UTC
      lastCrimeTime = currentTime;

      // Save the updated last crime time in the database (UTC)
      await pgClient.query(
        'INSERT INTO last_crime_times (user_id, last_crime_time) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET last_crime_time = $2',
        [userId, new Date(lastCrimeTime)]
      );

      // Generate random outcome
      const randomChance = Math.random(); // Random number between 0 and 1

      let responseMessage = '';
      let rewardAmount = 0;
      let embedColor = '#ffffff';  // Default to neutral color (white)

      if (randomChance <= 0.01) {
        // Jackpot (1% chance)
        rewardAmount = Math.floor(Math.random() * (120000 - 80000 + 1)) + 80000; // Random between 80,000 and 120,000
        userBalance += rewardAmount;

        const jackpotMessage = crimeJackpotMessages[Math.floor(Math.random() * crimeJackpotMessages.length)];
        responseMessage = jackpotMessage.replace('{{amount}}', rewardAmount); // Replace the variable with the actual amount
        embedColor = '#e3c207';  // Updated to yellow for jackpot

        console.log(`[JACKPOT] ${interaction.user.tag} earned ${rewardAmount} dustollarinos from a jackpot.`);
      } else if (randomChance <= 0.20) {
        // Success (19% chance)
        rewardAmount = Math.floor(Math.random() * (3000 - 1500 + 1)) + 1500; // Random between 1,500 and 3,000
        userBalance += rewardAmount;

        const successMessage = crimeSuccessMessages[Math.floor(Math.random() * crimeSuccessMessages.length)];
        responseMessage = successMessage.replace('{{amount}}', rewardAmount); // Replace the variable with the actual amount
        embedColor = '#02ba11';  // Positive outcome (green)

        console.log(`[SUCCESS] ${interaction.user.tag} earned ${rewardAmount} dustollarinos from a successful crime.`);
      } else if (randomChance <= 0.23) {
        // Critical Failure (3% chance)
        const criticalFailMessage = crimeCriticalFailMessages[Math.floor(Math.random() * crimeCriticalFailMessages.length)];

        // Critical failure means losing between 50% and 75% of the balance
        const lossPercentage = Math.random() * (0.75 - 0.50) + 0.50; // Random between 50% and 75%
        const lossAmount = Math.floor(userBalance * lossPercentage);
        userBalance -= lossAmount;

        responseMessage = criticalFailMessage.replace('{{amount}}', lossAmount);
        embedColor = '#ba0230';  // Negative outcome (red)
        console.log(`[CRITICAL FAILURE] ${interaction.user.tag} lost ${lossAmount} dustollarinos due to a critical failure.`);
      } else {
        // Failure (77% chance)
        const lossPercentage = Math.random() * (0.45 - 0.35) + 0.35; // Random between 35% and 45%
        const lossAmount = Math.floor(userBalance * lossPercentage);
        userBalance -= lossAmount;

        const failMessage = crimeFailMessages[Math.floor(Math.random() * crimeFailMessages.length)];
        responseMessage = failMessage.replace('{{amount}}', lossAmount); // Replace the variable with the actual amount
        embedColor = '#ba0230';  // Negative outcome (red)

        console.log(`[FAILURE] ${interaction.user.tag} lost ${lossAmount} dustollarinos due to failure.`);
      }

      // Update the user's balance in the database
      await pgClient.query(
        'INSERT INTO balances (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = $2',
        [userId, userBalance]
      );

      // Create the embed response
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription(responseMessage)
        .setTimestamp()
        .setFooter({ text: `Your new balance: ${userBalance} dustollarinos` });

      // Send the embed response (use `editReply` after defer)
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[ERROR] Error processing crime command:', error);
      await interaction.editReply({ content: 'There was an error processing your crime. Please try again later.' });
    }
  },
};
