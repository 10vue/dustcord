const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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

    const oneHour = 3600000; // One hour in milliseconds

    // Static variable to store last rob attempt time (reset on bot restart)
    if (!global.lastRobAttempt) {
      global.lastRobAttempt = {}; // Initialize if it doesn't exist
    }

    const currentTime = Date.now(); // Current time in milliseconds
    const lastRobTime = global.lastRobAttempt[userId] || 0; // Get last rob attempt time

    const timeSinceLastRob = currentTime - lastRobTime;

    if (timeSinceLastRob < oneHour) {
      const timeRemaining = Math.ceil((oneHour - timeSinceLastRob) / 60000); // Convert remaining time to minutes
      return interaction.editReply({
        content: `You need to wait ${timeRemaining} more minutes before trying to rob again!`,
        ephemeral: true,
      });
    }

    // Update the last rob attempt time
    global.lastRobAttempt[userId] = currentTime;

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
  },
};
