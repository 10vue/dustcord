const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const balancesPath = path.join(__dirname, '../data/balances.json');
    const dailyCooldownsPath = path.join(__dirname, '../data/dailyCooldowns.json');

    // Read balances and daily cooldown files
    let balances = {};
    let dailyCooldowns = {};
    try {
      balances = JSON.parse(fs.readFileSync(balancesPath));
      dailyCooldowns = JSON.parse(fs.readFileSync(dailyCooldownsPath));
    } catch (error) {
      console.error('[ERROR] Error reading data files:', error);
    }

    const now = new Date();

    // Set current time to Pacific/Auckland timezone
    const currentTime = new Date(now.toLocaleString('en-US', { timeZone: 'Pacific/Auckland' }));

    // Calculate today's midnight in GMT+13 (Pacific/Auckland)
    const todayMidnight = new Date(currentTime);
    todayMidnight.setHours(0, 0, 0, 0); // Set to midnight (00:00:00)

    // Check if user has already claimed today
    if (dailyCooldowns[userId] && dailyCooldowns[userId] > todayMidnight.getTime()) {
      // Calculate the remaining time until next claim (next midnight)
      const timeLeft = dailyCooldowns[userId] - currentTime.getTime();
      const remainingTime = new Date(timeLeft);

      // Format the remaining time as a Discord timestamp (relative time)
      const remainingTimestamp = `<t:${Math.floor((now.getTime() + timeLeft) / 1000)}:R>`;

      // Embed for cooldown message
      const embed = new EmbedBuilder()
        .setColor('#f4c542')  // Yellow color for cooldown state
        .setDescription(`You have already claimed your daily reward today! You can claim it again ${remainingTimestamp}.`);

      return interaction.reply({ embeds: [embed] });
    }

    // If no balance exists, initialize it to 0
    if (!balances[userId]) {
      balances[userId] = 0;
    }

    // Give the user their daily reward
    const rewardAmount = 1000;
    balances[userId] += rewardAmount;

    // Set the next cooldown for the user (next midnight)
    dailyCooldowns[userId] = todayMidnight.getTime() + 86400000; // 24 hours in milliseconds

    // Save updated balances and cooldowns
    try {
      fs.writeFileSync(balancesPath, JSON.stringify(balances, null, 2));
      fs.writeFileSync(dailyCooldownsPath, JSON.stringify(dailyCooldowns, null, 2));
    } catch (error) {
      console.error('[ERROR] Error saving data files:', error);
    }

    // Embed for successful daily claim with footer and timestamp
    const embed = new EmbedBuilder()
      .setColor('#02ba11')  // Green color for successful claim
      .setDescription(`You have claimed your daily reward of **${rewardAmount} coins**!`)
      .setFooter({ 
        text: `Your new balance: ${balances[userId]} coins`, 
        //iconURL: interaction.user.displayAvatarURL(),  // Optional: Avatar icon in footer
      })
      .setTimestamp();  // Adds a timestamp to the embed

    await interaction.reply({ embeds: [embed] });
    console.log(`[DAILY] ${interaction.user.tag} claimed their daily reward.`);
  },
};
