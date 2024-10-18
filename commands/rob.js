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
      const embed = new EmbedBuilder()
        .setColor('#ffcc00') // Yellow for warning
        .setDescription(`You need to wait ${timeRemaining} more minutes before trying to rob again!`);

      return interaction.editReply({ embeds: [embed], ephemeral: false });
    }

    // Update the last rob attempt time
    global.lastRobAttempt[userId] = currentTime;

    // Query target user balance
    const targetBalanceRes = await pgClient.query('SELECT balance FROM balances WHERE user_id = $1', [targetId]);
    const targetBalance = targetBalanceRes.rows.length ? targetBalanceRes.rows[0].balance : 0;

    if (amountToSteal > targetBalance) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000') // Red for error
        .setDescription(`The target doesn't have enough dustollarinos to rob! They currently have **${targetBalance}**.`);

      return interaction.editReply({ embeds: [embed], ephemeral: true });
    }

    // Calculate fail chance based on the amount being stolen
    const baseSuccessChance = 51; // Base success chance set to 51%
    const stealPercentage = (amountToSteal / targetBalance) * 100; // Percentage of balance being stolen
    const failChance = (stealPercentage / 2); // Halved percentage of the balance taken
    const successChance = baseSuccessChance - failChance; // Final success chance

    // Generate random number for success chance
    const randomNumber = Math.random() * 100; // Random number between 0 and 100

    if (randomNumber <= successChance) {
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

      const embed = new EmbedBuilder()
        .setColor('#02ba11') // Green for success
        .setDescription(`You successfully robbed **${amountToSteal} dustollarinos** from ${targetUser.username}!\n` +
                        `Your new balance is **${newUserBalance} dustollarinos**.`);

      return interaction.editReply({ embeds: [embed] });
    } else {
      // Failed robbery
      // Calculate penalty (25% to 75% of the attempted steal amount)
      const penaltyPercentage = Math.random() * (0.75 - 0.25) + 0.25; // Random between 25% and 75%
      const penaltyAmount = Math.floor(amountToSteal * penaltyPercentage);

      // Query user balance to apply the penalty
      const userBalanceRes = await pgClient.query('SELECT balance FROM balances WHERE user_id = $1', [userId]);
      const userBalance = userBalanceRes.rows.length ? userBalanceRes.rows[0].balance : 0;

      const penaltyNewBalance = Math.max(userBalance - penaltyAmount, 0); // Ensure balance does not go negative

      // Update user's balance after penalty
      await pgClient.query(
        'INSERT INTO balances (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance',
        [userId, penaltyNewBalance]
      );

      const embed = new EmbedBuilder()
        .setColor('#ba0230') // Red for failure
        .setDescription(`You failed to rob ${targetUser.username}. You incurred a penalty of **${penaltyAmount} dustollarinos**.\n` +
                        `Your new balance is **${penaltyNewBalance} dustollarinos**.`);

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
