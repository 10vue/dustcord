const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Command definition
module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top users with the highest balance'),

  async execute(interaction, pgClient) {  // Accept pgClient as a parameter
    // Defer the interaction to prevent timeouts
    await interaction.deferReply();

    // Query the balances table to get all users and their balances
    let balances = [];
    try {
      const res = await pgClient.query('SELECT user_id, balance FROM balances ORDER BY balance DESC LIMIT 10');
      balances = res.rows;  // Get the rows from the query
    } catch (error) {
      console.error('Error fetching balances from database:', error);
      return interaction.editReply('Unable to fetch leaderboard data at this time.');
    }

    // Format the leaderboard
    if (balances.length === 0) {
      return interaction.editReply('No leaderboard data available.');
    }

    // Fetch user names (display names) and prepare the leaderboard content
    const leaderboardPromises = balances.map(async (row, index) => {
      try {
        const user = await interaction.client.users.fetch(row.user_id);  // Fetch user details
        return `${index + 1}. ${user.username} - ${row.balance} dustollarinos`; // Use username instead of displayName
      } catch (error) {
        console.error(`[ERROR] Could not fetch user: ${row.user_id}`, error);
        return `${index + 1}. Unknown User - ${row.balance} dustollarinos`; // Fallback if user can't be fetched
      }
    });

    const leaderboard = await Promise.all(leaderboardPromises);

    // Create an embed for the leaderboard
    const leaderboardEmbed = new EmbedBuilder()
      .setColor('#FFFFFF') // White color for the leaderboard
      .setTitle('Leaderboard (Top 10 Users)')
      .setDescription(leaderboard.join('\n'))
      .setTimestamp()
      .setFooter({ text: 'Keep earning dustollarinos to climb the leaderboard!' });

    // Check if the user is in the top 10, and find their position if they are not
    const userId = interaction.user.id;  // Get the user ID
    const userRank = balances.findIndex(row => row.user_id === userId) + 1;

    let userRankMessage = '';
    if (userRank > 10 && userRank !== 0) {
      userRankMessage = `\nYour current rank is **#${userRank}** with **${balances[userRank - 1].balance} dustollarinos**. Keep going!`;
    } else if (userRank === 0) {
      userRankMessage = `\nYou have not earned any dustollarinos yet!`;
    }

    // Send the leaderboard embed along with the user's rank message if necessary
    await interaction.editReply({ 
      embeds: [leaderboardEmbed],
      content: userRankMessage
    });
  },
};
