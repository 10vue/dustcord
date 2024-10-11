const { SlashCommandBuilder, EmbedBuilder } = require('discord.js'); 
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top users with the highest balance'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const balancesPath = path.join(__dirname, '../data/balances.json');
    let balances = {};

    // Check if the balances file exists, and if not, create it
    try {
      balances = JSON.parse(fs.readFileSync(balancesPath));
    } catch (error) {
      console.error('Error reading balances file:', error);
      return interaction.reply('No balance data available.');
    }

    // Sort the users by their balances in descending order
    const sortedBalances = Object.entries(balances)
      .sort(([, a], [, b]) => b - a) // Sort by balance (descending)
      .slice(0, 10); // Get top 10 users

    // Format the leaderboard
    if (sortedBalances.length === 0) {
      return interaction.reply('No leaderboard data available.');
    }

    // Fetch user names (display names) and prepare the leaderboard content
    const leaderboardPromises = sortedBalances.map(async ([userId, balance], index) => {
      try {
        const user = await interaction.client.users.fetch(userId);  // Fetch user details
        return `${index + 1}. ${user.displayName} - ${balance} coins`; // Use displayName instead of username
      } catch (error) {
        console.error(`[ERROR] Could not fetch user: ${userId}`, error);
        return `${index + 1}. Unknown User - ${balance} coins`; // Fallback if user can't be fetched
      }
    });

    const leaderboard = await Promise.all(leaderboardPromises);

    // Create an embed for the leaderboard
    const leaderboardEmbed = new EmbedBuilder()
      .setColor('#FFFFFF') // White color for the leaderboard
      .setTitle('Leaderboard (Top 10 Users)')
      .setDescription(leaderboard.join('\n'))
      .setTimestamp()
      .setFooter({ text: 'Keep earning coins to climb the leaderboard!' });

    // Check if the user is in the top 10, and find their position if they are not
    let userRankMessage = '';
    const userRank = Object.entries(balances).sort(([, a], [, b]) => b - a).findIndex(([uid]) => uid === userId) + 1;

    if (userRank > 10) {
      userRankMessage = `\nYour current rank is **#${userRank}** with **${balances[userId]} coins**. Keep going!`;
    }

    // Send the leaderboard embed along with the user's rank message if necessary
    await interaction.reply({ 
      embeds: [leaderboardEmbed],
      content: userRankMessage
    });
  },
};
