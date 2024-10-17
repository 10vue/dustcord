const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Path to the balances file
const balancesFilePath = path.join(__dirname, '../data/balances.json');

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
        .setRequired(false)) // New option for payment
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

    // Reload balances from the file each time the command is executed
    let balances = {};
    if (fs.existsSync(balancesFilePath)) {
      balances = JSON.parse(fs.readFileSync(balancesFilePath, 'utf8'));
    } else {
      fs.writeFileSync(balancesFilePath, JSON.stringify(balances));
    }

    // Check the balance of the target user
    const targetUserId = targetUser.id;
    if (!balances[targetUserId]) {
      balances[targetUserId] = 0;
    }

    // Embed setup with white color
    const embed = new EmbedBuilder().setColor('#ffffff');

    // Admin functionality: Add or remove balance
    if (userId === '346788080637837315') {
      if (addAmount !== null) {
        balances[targetUserId] += addAmount;
        fs.writeFileSync(balancesFilePath, JSON.stringify(balances, null, 2));
        embed.setDescription(`Successfully added **${addAmount}** dustollarinos to ${targetUser.username}'s balance.`);
        return interaction.reply({ embeds: [embed] });
      }

      if (removeAmount !== null) {
        balances[targetUserId] = Math.max(0, balances[targetUserId] - removeAmount);
        fs.writeFileSync(balancesFilePath, JSON.stringify(balances, null, 2));
        embed.setDescription(`Successfully removed **${removeAmount}** dustollarinos from ${targetUser.username}'s balance.`);
        return interaction.reply({ embeds: [embed] });
      }
    }

    // If 'pay' option is provided, handle the transfer
    if (payAmount !== null && payToUser) {
      const senderBalance = balances[userId];
      const recipientId = payToUser.id;

      // Ensure the sender has enough balance to pay
      if (senderBalance < payAmount) {
        embed.setColor('#ba0230')  // Negative outcome color
          .setDescription(`You don't have enough dustollarinos to pay **${payAmount}** dustollarinos. Your current balance is **${senderBalance} dustollarinos**.`);
        return interaction.reply({ embeds: [embed] });
      }

      // Transfer the dustollarinos from the sender to the recipient
      balances[userId] -= payAmount;
      if (!balances[recipientId]) balances[recipientId] = 0;
      balances[recipientId] += payAmount;

      // Save the updated balances
      fs.writeFileSync(balancesFilePath, JSON.stringify(balances, null, 2));

      embed.setColor('#02ba11')  // Positive outcome color
        .setDescription(`Successfully paid **${payAmount}** dustollarinos to ${payToUser.username}. Your new balance is **${balances[userId]} dustollarinos**.`);
      return interaction.reply({ embeds: [embed] });
    }

    // Show the balance of the target user
    embed.setDescription(`${targetUser.username}'s balance is **${balances[targetUserId]} dustollarinos**.`);
    await interaction.reply({ embeds: [embed] });
  },
};
