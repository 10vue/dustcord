const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone'); // Import moment-timezone

// Rob command to attempt robbing another user
module.exports = {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Attempt to rob another user.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user you want to rob')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('The amount of dustollarinos you want to steal')
        .setRequired(true)),

  async execute(interaction, pgClient) {
    await interaction.deferReply();
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser('target');
    const targetId = targetUser.id;
    const amountToSteal = interaction.options.getInteger('amount');

    // Get the current time in the desired timezone (set via environment variable)
    const timezone = process.env.TIMEZONE || 'UTC'; // Default to UTC if TIMEZONE isn't set
    const currentTime = moment().tz(timezone).valueOf(); // Get the current time in the specified timezone

    const oneHour = 3600000; // 1 hour in milliseconds

    try {
      const lastRobRes = await pgClient.query('SELECT last_rob_time FROM last_rob_times WHERE user_id = $1', [userId]);
      const lastRobTime = lastRobRes.rows.length ? moment(lastRobRes.rows[0].last_rob_time).tz(timezone).valueOf() : 0;

      const timeSinceLastRob = currentTime - lastRobTime;

      if (timeSinceLastRob < oneHour) {
        const timeRemaining = Math.ceil((oneHour - timeSinceLastRob) / 60000); // Convert remaining time to minutes
        return interaction.editReply({
          content: `You need to wait ${timeRemaining} more minutes before trying to rob again!`,
          ephemeral: true,
        });
      }

      // The rest of your rob command logic...
    } catch (error) {
      console.error('[ERROR] Error processing rob command:', error);
      await interaction.editReply({ content: 'There was an error processing your robbery attempt. Please try again later.' });
    }
  },
};
