const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const balancesFilePath = path.join(__dirname, '../data/balances.json');
const lastRobTimesPath = path.join(__dirname, '../data/lastRobTimes.json');

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

  async execute(interaction) {
    // Defer reply to avoid timeout issues
    await interaction.deferReply();

    // Ensure the lastRobTimes.json file exists
    if (!fs.existsSync(lastRobTimesPath)) {
      fs.writeFileSync(lastRobTimesPath, JSON.stringify({}, null, 2)); // Create file with an empty object
    }

    // Read the balances and lastRobTimes from the file
    let balances = {};
    let lastRobTimes = {};
    if (fs.existsSync(balancesFilePath)) {
      balances = JSON.parse(fs.readFileSync(balancesFilePath, 'utf8'));
    } else {
      fs.writeFileSync(balancesFilePath, JSON.stringify(balances));
    }
    try {
      lastRobTimes = JSON.parse(fs.readFileSync(lastRobTimesPath, 'utf8'));
    } catch (error) {
      console.error('[ERROR] Error reading lastRobTimes file:', error);
    }

    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser('target');
    const targetId = targetUser.id;
    const amountToSteal = interaction.options.getInteger('amount');

    // Cooldown logic: one hour (3600000 milliseconds)
    const currentTime = Date.now();
    const oneHour = 3600000; // 1 hour in milliseconds
    const timeSinceLastRob = currentTime - (lastRobTimes[userId] || 0);

    if (timeSinceLastRob < oneHour) {
      const timeRemaining = Math.ceil((oneHour - timeSinceLastRob) / 60000); // Convert remaining time to minutes
      return interaction.editReply({
        content: `You need to wait ${timeRemaining} more minutes before trying to rob again!`,
        ephemeral: true,
      });
    }

    if (userId === targetId) {
      const embed = new EmbedBuilder()
        .setColor('#ba0230')  // Negative outcome color
        .setDescription('You cannot rob yourself!');
      return interaction.editReply({ embeds: [embed] });
    }

    // Ensure both users have balances
    if (!balances[userId]) balances[userId] = 0;
    if (!balances[targetId]) balances[targetId] = 0;

    const targetBalance = balances[targetId];

    // Check if the amount being stolen is at least 1 dustollarino
    if (amountToSteal < 1) {
      const embed = new EmbedBuilder()
        .setColor('#ba0230')  // Negative outcome color
        .setDescription('You cannot steal less than 1 dustollarino!');
      return interaction.editReply({ embeds: [embed] });
    }

    // Check if the target has enough balance to be worth robbing
    if (targetBalance < 100) {
      const embed = new EmbedBuilder()
        .setColor('#ffffff')  // Neutral outcome color
        .setDescription(`${targetUser.username} does not have enough dustollarinos to be worth robbing.`);
      return interaction.editReply({ embeds: [embed] });
    }

    // Check if the requested amount is reasonable
    if (amountToSteal > targetBalance) {
      const embed = new EmbedBuilder()
        .setColor('#ba0230')  // Negative outcome color
        .setDescription(`You cannot steal more than what ${targetUser.username} has! They only have **${targetBalance} dustollarinos**.`);
      return interaction.editReply({ embeds: [embed] });
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

      // Update last robbery time
      lastRobTimes[userId] = currentTime;
      fs.writeFileSync(lastRobTimesPath, JSON.stringify(lastRobTimes, null, 2));

      const embed = new EmbedBuilder()
        .setColor('#02ba11')  // Positive outcome color
        .setDescription(`You successfully robbed **${amountToSteal} dustollarinos** from ${targetUser.username}.`)
        .setTimestamp()  // Add timestamp
        .setFooter({ text: `Your new balance: ${balances[userId]} dustollarinos` });  // Add balance update in the footer
      return interaction.editReply({ embeds: [embed] });
    } else {
      // Failed robbery (negative outcome)
      const fineAmount = Math.ceil(amountToSteal / 2);  // Round fine amount up to the nearest whole number

      balances[userId] = Math.max(balances[userId] - fineAmount, 0); // Deduct fine but don't go below zero

      // Save balances to file
      fs.writeFileSync(balancesFilePath, JSON.stringify(balances, null, 2));

      // Update last robbery time
      lastRobTimes[userId] = currentTime;
      fs.writeFileSync(lastRobTimesPath, JSON.stringify(lastRobTimes, null, 2));

      const embed = new EmbedBuilder()
        .setColor('#ba0230')  // Negative outcome color
        .setDescription(`You got caught trying to rob ${targetUser.username} and got fined **${fineAmount} dustollarinos**.`)
        .setTimestamp()  // Add timestamp
        .setFooter({ text: `Your new balance: ${balances[userId]} dustollarinos` });  // Add balance update in the footer
      return interaction.editReply({ embeds: [embed] });
    }
  },
};
