const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Slut outcomes data
const successMessages = require('../data/slutOutcomes/slutSuccess.json');
const mediocreMessages = require('../data/slutOutcomes/slutMediocre.json');
const unattractiveMessages = require('../data/slutOutcomes/slutUnattractive.json');
const caughtMessages = require('../data/slutOutcomes/slutCaught.json'); // Import caught messages

// Static variable to store last attempt time for each user (reset on bot restart)
global.lastSlutAttempt = global.lastSlutAttempt || {};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slut')
    .setDescription('Try your luck for dustollarinos!'),

  async execute(interaction, pgClient) {
    await interaction.deferReply(); // Defer the reply for better user experience
    const userId = interaction.user.id;

    const oneHour = 3600000; // 1 hour in milliseconds
    const currentTime = Date.now(); // Current time in milliseconds

    // Check last attempt time
    const lastSlutTime = global.lastSlutAttempt[userId] || 0; // Get last attempt time for the user
    const timeSinceLastAttempt = currentTime - lastSlutTime;

    if (timeSinceLastAttempt < oneHour) {
      const timeRemaining = Math.ceil((oneHour - timeSinceLastAttempt) / 60000); // Convert remaining time to minutes
      return interaction.editReply({
        content: `You need to wait ${timeRemaining} more minutes before trying again!`,
        ephemeral: true,
      });
    }

    // Update the last attempt time
    global.lastSlutAttempt[userId] = currentTime;

    // Generate random outcome
    const randomChance = Math.random(); // Random number between 0 and 1
    let responseMessage = '';
    let rewardAmount = 0;
    let embedColor = '#ffffff';  // Default to neutral color (white)
    let userBalance = 0; // Initialize userBalance variable

    // Query user balance once at the beginning
    const balanceRes = await pgClient.query('SELECT balance FROM balances WHERE user_id = $1', [userId]);
    userBalance = balanceRes.rows.length ? balanceRes.rows[0].balance : 0;

    if (randomChance <= 0.40) {
      // Success (40% chance)
      rewardAmount = Math.floor(Math.random() * (1500 - 500 + 1)) + 500; // Random between 500 and 1500
      const successMessage = successMessages[Math.floor(Math.random() * successMessages.length)];
      responseMessage = successMessage.replace('{{amount}}', rewardAmount); // Replace the variable with the actual amount
      embedColor = '#02ba11';  // Positive outcome (green)

      console.log(`[SUCCESS] ${interaction.user.tag} earned ${rewardAmount} dustollarinos from a successful attempt.`);
    } else if (randomChance <= 0.70) {
      // Mediocre (30% chance)
      rewardAmount = Math.floor(Math.random() * (100 - 10 + 1)) + 10; // Random between 10 and 100
      const mediocreMessage = mediocreMessages[Math.floor(Math.random() * mediocreMessages.length)];
      responseMessage = mediocreMessage.replace('{{amount}}', rewardAmount); // Replace the variable with the actual amount
      embedColor = '#f4c542';  // Neutral outcome (yellow)

      console.log(`[MEDIOCRE] ${interaction.user.tag} earned ${rewardAmount} dustollarinos from a mediocre attempt.`);
    } else if (randomChance <= 0.90) {
      // Caught (20% chance)
      const lossPercentage = Math.random() * (0.10 - 0.05) + 0.05; // Random between 5% and 10% loss
      const lossAmount = Math.floor(userBalance * lossPercentage);
      const caughtMessage = caughtMessages[Math.floor(Math.random() * caughtMessages.length)]; // Get a random caught message
      responseMessage = caughtMessage.replace('{{amount}}', lossAmount); // Replace the variable with the actual amount
      embedColor = '#ba0230';  // Negative outcome (red)

      // Update user balance
      const newBalance = Math.max(userBalance - lossAmount, 0);
      await pgClient.query('INSERT INTO balances (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance', [userId, newBalance]);
      userBalance = newBalance; // Update userBalance to the new balance

      console.log(`[CAUGHT] ${interaction.user.tag} lost ${lossAmount} dustollarinos due to being caught.`);
    } else {
      // Unattractive (10% chance)
      const unattractiveMessage = unattractiveMessages[Math.floor(Math.random() * unattractiveMessages.length)];
      responseMessage = unattractiveMessage; // Message for unattractive outcome
      embedColor = '#000000';  // Black for unattractive (no dustollarinos involved)

      console.log(`[UNATTRACTIVE] ${interaction.user.tag} had an unattractive outcome.`);
    }

    // Update the user's balance in the database if there's a reward
    if (rewardAmount > 0) {
      if (!balanceRes.rows.length) {
        await pgClient.query('INSERT INTO balances (user_id, balance) VALUES ($1, $2)', [userId, rewardAmount]);
        userBalance = rewardAmount; // Update the userBalance to the new amount
        responseMessage += ` You now have **${userBalance} dustollarinos**.`;
      } else {
        userBalance += rewardAmount; // Update the userBalance to reflect the new balance
        await pgClient.query('UPDATE balances SET balance = $1 WHERE user_id = $2', [userBalance, userId]);
        responseMessage += ` Your new balance is **${userBalance} dustollarinos**.`;
      }
    }

    // Create the embed response
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setDescription(responseMessage)
      .setTimestamp()
      .setFooter({ text: `Your new balance: ${userBalance} dustollarinos` });

    // Send the embed response (use `editReply` after defer)
    await interaction.editReply({ embeds: [embed] });
  },
};
