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
        .setRequired(false)),

  async execute(interaction) {
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const addAmount = interaction.options.getInteger('add');
    const removeAmount = interaction.options.getInteger('remove');

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

    // If the user is authorized, allow them to add or remove from the balance
    if (userId === '346788080637837315') {
      if (addAmount !== null) {
        balances[targetUserId] += addAmount;
        fs.writeFileSync(balancesFilePath, JSON.stringify(balances, null, 2));
        embed.setDescription(`Successfully added **${addAmount}** coins to ${targetUser.username}'s balance.`);
        return interaction.reply({ embeds: [embed] });
      }

      if (removeAmount !== null) {
        balances[targetUserId] = Math.max(0, balances[targetUserId] - removeAmount);
        fs.writeFileSync(balancesFilePath, JSON.stringify(balances, null, 2));
        embed.setDescription(`Successfully removed **${removeAmount}** coins from ${targetUser.username}'s balance.`);
        return interaction.reply({ embeds: [embed] });
      }
    }

    // Show the balance of the target user
    embed.setDescription(`${targetUser.username}'s balance is **${balances[targetUserId]} coins**.`);
    await interaction.reply({ embeds: [embed] });
  },
};
