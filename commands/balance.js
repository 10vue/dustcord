const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Pool } = require('pg');

// Set up PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Make sure your Heroku config vars include this
  ssl: {
    rejectUnauthorized: false,  // Heroku requires SSL connection, so this is necessary
  },
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your balance, someone else\'s balance, add or remove balance (Admin Only).')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user whose balance you want to check.')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('add')
        .setDescription('Amount to add to balance (Admin Only).')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('remove')
        .setDescription('Amount to remove from balance (Admin Only).')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('pay')
        .setDescription('Amount to pay to another user.')
        .setRequired(false))  // New option for payment
    .addUserOption(option =>
      option.setName('payto')
        .setDescription('The user to pay.')
        .setRequired(false)), // User option to specify the recipient

  async execute(interaction) {
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const addAmount = interaction.options.getInteger('add');
    const removeAmount = interaction.options.getInteger('remove');
    const payAmount = interaction.options.getInteger('pay');
    const payToUser = interaction.options.getUser('payto');

    // Embed setup with white color
    const embed = new EmbedBuilder().setColor('#ffffff');

    try {
      // Admin functionality: Add or remove balance
      if (userId === '346788080637837315') {
        if (addAmount !== null) {
          await pool.query(
            'INSERT INTO balances (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = balances.balance + $2',
            [targetUser.id, addAmount]
          );
          embed.setDescription(`Successfully added **${addAmount}** dustollarinos to ${targetUser.username}'s balance.`);
          return interaction.reply({ embeds: [embed] });
        }

        if (removeAmount !== null) {
          await pool.query(
            'UPDATE balances SET balance = GREATEST(0, balance - $2) WHERE user_id = $1',
            [targetUser.id, removeAmount]
          );
          embed.setDescription(`Successfully removed **${removeAmount}** dustollarinos from ${targetUser.username}'s balance.`);
          return interaction.reply({ embeds: [embed] });
        }
      }

      // If 'pay' option is provided, handle the transfer
      if (payAmount !== null && payToUser) {
        const senderResult = await pool.query('SELECT balance FROM balances WHERE user_id = $1', [userId]);
        const senderBalance = senderResult.rows[0] ? senderResult.rows[0].balance : 0;

        // Ensure the sender has enough balance to pay
        if (senderBalance < payAmount) {
          embed.setColor('#ba0230')  // Negative outcome color
            .setDescription(`You don't have enough dustollarinos to pay **${payAmount}** dustollarinos. Your current balance is **${senderBalance} dustollarinos**.`);
          return interaction.reply({ embeds: [embed] });
        }

        // Transfer the dustollarinos from the sender to the recipient
        await pool.query('UPDATE balances SET balance = balance - $2 WHERE user_id = $1', [userId, payAmount]);
        await pool.query(
          'INSERT INTO balances (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = balances.balance + $2',
          [payToUser.id, payAmount]
        );

        embed.setColor('#02ba11')  // Positive outcome color
          .setDescription(`Successfully paid **${payAmount}** dustollarinos to ${payToUser.username}. Your new balance is **${senderBalance - payAmount} dustollarinos**.`);
        return interaction.reply({ embeds: [embed] });
      }

      // Show the balance of the target user
      const result = await pool.query('SELECT balance FROM balances WHERE user_id = $1', [targetUser.id]);
      const balance = result.rows[0] ? result.rows[0].balance : 0;

      embed.setDescription(`${targetUser.username}'s balance is **${balance} dustollarinos**.`);
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error interacting with the database:', error);
      embed.setColor('#ba0230').setDescription('An error occurred while interacting with the database.');
      await interaction.reply({ embeds: [embed] });
    }
  },
};
