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
    const timezone = process.env.TIMEZONE || 'Pacific/Auckland'; // Default to Pacific/Auckland if TIMEZONE isn't set
    const currentTime = moment().tz(timezone).valueOf(); // Get the current time in the specified timezone

    const oneHour = 3600000; // 1 hour in milliseconds

    try {
      // Query last rob attempt time from the database
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

      // Update the last rob attempt time
      await pgClient.query(
        'INSERT INTO last_rob_times (user_id, last_rob_time) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET last_rob_time = $2',
        [userId, new Date(currentTime)]
      );

      // Query target user balance
      const targetBalanceRes = await pgClient.query('SELECT balance FROM balances WHERE user_id = $1', [targetId]);
      const targetBalance = targetBalanceRes.rows.length ? targetBalanceRes.rows[0].balance : 0;

      if (amountToSteal > targetBalance) {
        return interaction.editReply({
          content: `The target doesn't have enough dustollarinos to rob! They currently have **${targetBalance}**.`,
          ephemeral: true,
        });
      }

      // Random success chance (for example, 60%)
      const successChance = Math.random();
      if (successChance <= 0.60) {
        // Successful robbery
        const newTargetBalance = targetBalance - amountToSteal;

        // Update target's balance
        await pgClient.query(
          'INSERT INTO balances (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance',
          [targetId, newTargetBalance]
        );

        // Query user balance
        const userBalanceRes = await pgClient.query('SELECT balance FROM balances WHERE user_id = $1', [userId]);
        const userBalance = userBalanceRes.rows.length ? userBalanceRes.rows[0].balance : 0;

        const newUserBalance = userBalance + amountToSteal;

        // Update user's balance
        await pgClient.query(
          'INSERT INTO balances (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance',
          [userId, newUserBalance]
        );

        return interaction.editReply({
          content: `You successfully robbed **${amountToSteal} dustollarinos** from ${targetUser.username}! Your new balance is **${newUserBalance}**.`,
        });
      } else {
        // Failed robbery
        return interaction.editReply({
          content: `You failed to rob ${targetUser.username}. Better luck next time!`,
        });
      }
    } catch (error) {
      console.error('[ERROR] Error processing rob command:', error);
      await interaction.editReply({ content: 'There was an error processing your robbery attempt. Please try again later.' });
    }
  },
};
