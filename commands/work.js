const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Cooldown Map to track last command usage
const cooldowns = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Do some work and earn dustollarinos!'),

  async execute(interaction, pgClient) {
    const userId = interaction.user.id;

    // Check for cooldown
    const now = Date.now();
    const cooldownAmount = 10 * 60 * 1000; // 10 minutes in milliseconds

    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId) + cooldownAmount;

      if (now < expirationTime) {
        const timeLeft = expirationTime - now; // Time left in milliseconds

        // Convert milliseconds to full minutes
        const minutesLeft = Math.ceil(timeLeft / 60000); // Convert to minutes and round up

        // Singular or plural "minute"
        const minuteText = minutesLeft === 1 ? 'minute' : 'minutes';

        // Reply with the cooldown message
        return interaction.reply({
          content: `You need to wait ${minutesLeft} more ${minuteText} before working again!`,
          ephemeral: false, // Message is visible to everyone
        });
      }
    }

    // Set the cooldown for the user
    cooldowns.set(userId, now);

    // Randomly determine the earnings based on defined probabilities
    const randomValue = Math.random(); // Generates a number between 0 and 1
    let earnedAmount;

    if (randomValue < 0.7) { // 70% chance
      earnedAmount = 200;
    } else { // 30% chance
      earnedAmount = 500;
    }

    // Update the user's balance in the database
    try {
      await pgClient.query('UPDATE balances SET balance = balance + $1 WHERE user_id = $2', [earnedAmount, userId]);

      // Send a success message
      const embed = new EmbedBuilder()
        .setColor('#4caf50') // Set a green color
        .setDescription(`You did some work and earned **${earnedAmount} dustollarinos**!`);

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error updating balance:', error);
      await interaction.reply('There was an error updating your balance. Please try again later.');
    }
  },
};
