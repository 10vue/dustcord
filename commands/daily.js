const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Client } = require('pg');  // Import pg client

// Initialize PostgreSQL client with the DATABASE_URL from Heroku
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,  // Heroku's Postgres URL stored in .env
  ssl: {
    rejectUnauthorized: false,  // Required for Heroku Postgres
  },
});

pgClient.connect();  // Connect to the database

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward'),

  async execute(interaction) {
    const userId = interaction.user.id;

    const now = new Date();

    // Set current time to Pacific/Auckland timezone
    const currentTime = new Date(now.toLocaleString('en-US', { timeZone: 'Pacific/Auckland' }));

    // Calculate today's midnight in GMT+13 (Pacific/Auckland)
    const todayMidnight = new Date(currentTime);
    todayMidnight.setHours(0, 0, 0, 0); // Set to midnight (00:00:00)

    try {
      // Query user's balance and daily cooldown from the database
      const balanceRes = await pgClient.query('SELECT balance FROM balances WHERE user_id = $1', [userId]);
      const cooldownRes = await pgClient.query('SELECT cooldown FROM daily_cooldowns WHERE user_id = $1', [userId]);

      let userBalance = balanceRes.rows.length ? balanceRes.rows[0].balance : 0;
      let lastClaimTime = cooldownRes.rows.length ? new Date(cooldownRes.rows[0].cooldown).getTime() : 0;

      // Check if user has already claimed today
      if (lastClaimTime > todayMidnight.getTime()) {
        // Calculate the remaining time until next claim (next midnight)
        const timeLeft = lastClaimTime - currentTime.getTime();
        const remainingTimestamp = `<t:${Math.floor((now.getTime() + timeLeft) / 1000)}:R>`; // Format remaining time

        // Embed for cooldown message
        const embed = new EmbedBuilder()
          .setColor('#f4c542')  // Yellow color for cooldown state
          .setDescription(`You have already claimed your daily reward today! You can claim it again ${remainingTimestamp}.`);

        return interaction.reply({ embeds: [embed] });
      }

      // Give the user their daily reward
      const rewardAmount = 1000;
      userBalance += rewardAmount;

      // Set the next cooldown for the user (next midnight)
      lastClaimTime = todayMidnight.getTime() + 86400000; // 24 hours in milliseconds

      // Save updated balances and cooldowns in the database
      await pgClient.query(
        'INSERT INTO balances (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = $2',
        [userId, userBalance]
      );

      await pgClient.query(
        'INSERT INTO daily_cooldowns (user_id, cooldown) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET cooldown = $2',
        [userId, new Date(lastClaimTime)]
      );

      // Embed for successful daily claim with footer and timestamp
      const embed = new EmbedBuilder()
        .setColor('#02ba11')  // Green color for successful claim
        .setDescription(`You have claimed your daily reward of **${rewardAmount} dustollarinos**!`)
        .setFooter({
          text: `Your new balance: ${userBalance} dustollarinos`,
        })
        .setTimestamp();  // Adds a timestamp to the embed

      await interaction.reply({ embeds: [embed] });
      console.log(`[DAILY] ${interaction.user.tag} claimed their daily reward.`);
    } catch (error) {
      console.error('[ERROR] Error processing daily command:', error);
      await interaction.reply({ content: 'There was an error processing your daily reward. Please try again later.' });
    }
  },
};
