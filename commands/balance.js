const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your balance, someone else\'s balance, add or remove balance (Admin Only).')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user whose balance you want to check.'))
    .addIntegerOption(option =>
      option.setName('add')
        .setDescription('Amount to add to balance (Admin Only).'))
    .addIntegerOption(option =>
      option.setName('remove')
        .setDescription('Amount to remove from balance (Admin Only).'))
    .addIntegerOption(option =>
      option.setName('pay')
        .setDescription('Amount to pay to another user.')),

  async execute(interaction, pgClient) { // Use pgClient passed from index.js
    await interaction.deferReply(); // Defer reply to prevent interaction timeout

    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const addAmount = interaction.options.getInteger('add');
    const removeAmount = interaction.options.getInteger('remove');
    const payAmount = interaction.options.getInteger('pay');

    const embed = new EmbedBuilder().setColor('#ffffff');

    try {
      // Admin functionality: Add or remove balance
      if (userId === '346788080637837315') { // Your user ID for admin checks
        if (addAmount !== null) {
          await pgClient.query(
            'INSERT INTO balances (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = balances.balance + $2',
            [targetUser.id, addAmount]
          );
          embed.setDescription(`Successfully added **${addAmount}** dustollarinos to ${targetUser.username}'s balance.`);
          return interaction.editReply({ embeds: [embed] });
        }

        if (removeAmount !== null) {
          await pgClient.query(
            'UPDATE balances SET balance = GREATEST(0, balance - $2) WHERE user_id = $1',
            [targetUser.id, removeAmount]
          );
          embed.setDescription(`Successfully removed **${removeAmount}** dustollarinos from ${targetUser.username}'s balance.`);
          return interaction.editReply({ embeds: [embed] });
        }
      }

      // Handle payment to another user
      if (payAmount !== null) {
        // Ensure payAmount is positive
        if (payAmount <= 0) {
          embed.setColor('#ba0230')
            .setDescription('You cannot pay a negative or zero amount.');
          return interaction.editReply({ embeds: [embed] });
        }

        // Ensure the sender has enough balance to pay
        const senderResult = await pgClient.query('SELECT balance FROM balances WHERE user_id = $1', [userId]);
        const senderBalance = senderResult.rows[0] ? senderResult.rows[0].balance : 0;

        if (senderBalance < payAmount) {
          embed.setColor('#ba0230')
            .setDescription(`You don't have enough dustollarinos to pay **${payAmount}** dustollarinos. Your current balance is **${senderBalance} dustollarinos**.`);
          return interaction.editReply({ embeds: [embed] });
        }

        // Transfer dustollarinos from sender to recipient
        await pgClient.query('UPDATE balances SET balance = balance - $2 WHERE user_id = $1', [userId, payAmount]);
        await pgClient.query(
          'INSERT INTO balances (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = balances.balance + $2',
          [targetUser.id, payAmount]
        );

        embed.setColor('#02ba11')
          .setDescription(`Successfully paid **${payAmount}** dustollarinos to ${targetUser.username}. Your new balance is **${senderBalance - payAmount} dustollarinos**.`);
        return interaction.editReply({ embeds: [embed] });
      }

      // Show the balance of the target user
      const result = await pgClient.query('SELECT balance FROM balances WHERE user_id = $1', [targetUser.id]);
      const balance = result.rows[0] ? result.rows[0].balance : 0;

      embed.setDescription(`${targetUser.username}'s balance is **${balance} dustollarinos**.`);
      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error interacting with the database:', error);
      embed.setColor('#ba0230').setDescription('An error occurred while interacting with the database.');
      return interaction.editReply({ embeds: [embed] });
    }
  },
};
