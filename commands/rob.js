const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const balancesFilePath = path.join(__dirname, '../data/balances.json');

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
        .setDescription('The amount of coins you want to steal')
        .setRequired(true)),

  async execute(interaction) {
    // Read the balances from the file (or initialize empty if no file)
    let balances = {};
    if (fs.existsSync(balancesFilePath)) {
      balances = JSON.parse(fs.readFileSync(balancesFilePath, 'utf8'));
    } else {
      fs.writeFileSync(balancesFilePath, JSON.stringify(balances));
    }

    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser('target');
    const targetId = targetUser.id;
    const amountToSteal = interaction.options.getInteger('amount');
    
    if (userId === targetId) {
      const embed = new EmbedBuilder()
        .setColor('#ba0230')  // Negative outcome color
        .setDescription('You cannot rob yourself!')
      return interaction.reply({ embeds: [embed] });
    }
    
    // Ensure both users have balances
    if (!balances[userId]) balances[userId] = 0;
    if (!balances[targetId]) balances[targetId] = 0;

    const targetBalance = balances[targetId];

    // Check if the amount being stolen is at least 1 coin
    if (amountToSteal < 1) {
      const embed = new EmbedBuilder()
        .setColor('#ba0230')  // Negative outcome color
        .setDescription('You cannot steal less than 1 coin!')
      return interaction.reply({ embeds: [embed] });
    }

    // Check if the target has enough balance to be worth robbing
    if (targetBalance < 100) {
      const embed = new EmbedBuilder()
        .setColor('#ffffff')  // Neutral outcome color
        .setDescription(`${targetUser.username} does not have enough coins to be worth robbing.`)
      return interaction.reply({ embeds: [embed] });
    }

    // Check if the requested amount is reasonable
    if (amountToSteal > targetBalance) {
      const embed = new EmbedBuilder()
        .setColor('#ba0230')  // Negative outcome color
        .setDescription(`You cannot steal more than what ${targetUser.username} has! They only have **${targetBalance} coins**.`)
      return interaction.reply({ embeds: [embed] });
    }

    // Calculate percentage of target's balance
    const percentage = (amountToSteal / targetBalance) * 100;

    // Calculate success chance based on percentage
    const baseChance = 60;
    const successChance = baseChance - (percentage / 2); // Adjust formula for success

    // Perform the robbery attempt
    const robSuccess = Math.random() * 100 < successChance;

    if (robSuccess) {
      // Successful robbery (positive outcome)
      balances[targetId] -= amountToSteal;
      balances[userId] += amountToSteal;

      // Save balances to file
      fs.writeFileSync(balancesFilePath, JSON.stringify(balances, null, 2));

      const embed = new EmbedBuilder()
        .setColor('#02ba11')  // Positive outcome color
        .setDescription(`You successfully robbed **${amountToSteal} coins** from ${targetUser.username}.`)
        .setTimestamp()  // Add timestamp
        .setFooter({text:`Your new balance: ${balances[userId]} coins`});  // Add balance update in the footer
      return interaction.reply({ embeds: [embed] });
    } else {
      // Failed robbery (negative outcome)
      const fineAmount = Math.ceil(amountToSteal / 2);  // Round fine amount up to the nearest whole number

      balances[userId] = Math.max(balances[userId] - fineAmount, 0); // Deduct fine but don't go below zero

      // Save balances to file
      fs.writeFileSync(balancesFilePath, JSON.stringify(balances, null, 2));

      const embed = new EmbedBuilder()
        .setColor('#ba0230')  // Negative outcome color
        .setDescription(`You got caught trying to rob ${targetUser.username} and got fined **${fineAmount} coins**.`)
        .setTimestamp()  // Add timestamp
        .setFooter({text:`Your new balance: ${balances[userId]} coins`});  // Add balance update in the footer
      return interaction.reply({ embeds: [embed] });
    }
  },
};
