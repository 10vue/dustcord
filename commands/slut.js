const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Client } = require('pg');  // PostgreSQL client
const path = require('path');

const client = new Client({
  connectionString: process.env.DATABASE_URL,  // Database URL from Heroku config vars
  ssl: {
    rejectUnauthorized: false,  // Use this for Heroku SSL connection
  },
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slut')
    .setDescription('Try your luck for dustollarinos!'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const currentTime = Date.now();
    
    // Connect to the database
    await client.connect();

    // Check the last attempt time
    const resCooldown = await client.query('SELECT last_slut_time FROM last_slut_times WHERE user_id = $1', [userId]);
    const lastSlutTime = resCooldown.rows[0] ? resCooldown.rows[0].last_slut_time : null;

    const oneHour = 3600000; // 1 hour in milliseconds
    if (lastSlutTime && currentTime - lastSlutTime < oneHour) {
      const timeRemaining = Math.ceil((oneHour - (currentTime - lastSlutTime)) / 60000); // Convert remaining time to minutes
      return interaction.reply({
        content: `You need to wait ${timeRemaining} more minutes before trying again!`,
        ephemeral: true,
      });
    }

    // Update the last attempt time
    await client.query('INSERT INTO last_slut_times (user_id, last_slut_time) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET last_slut_time = $2', [userId, currentTime]);

    // Generate random outcome based on probabilities
    const randomChance = Math.random();
    let responseMessage = '';
    let rewardAmount = 0;
    let embedColor = '#ffffff';  // Default neutral color

    // Success (40% chance)
    if (randomChance <= 0.40) {
      rewardAmount = Math.floor(Math.random() * (1500 - 500 + 1)) + 500; // Random between 500 and 1500
      const successRes = await client.query('SELECT message FROM slut_success');
      const successMessages = successRes.rows.map(row => row.message);
      const successMessage = successMessages[Math.floor(Math.random() * successMessages.length)];
      responseMessage = successMessage.replace('{{amount}}', rewardAmount); // Replace {{amount}} with actual dustollarinos earned
      embedColor = '#02ba11';  // Green for success
    } 
    // Mediocre (30% chance)
    else if (randomChance <= 0.70) {
      rewardAmount = Math.floor(Math.random() * (100 - 10 + 1)) + 10; // Random between 10 and 100
      const mediocreRes = await client.query('SELECT message FROM slut_mediocre');
      const mediocreMessages = mediocreRes.rows.map(row => row.message);
      const mediocreMessage = mediocreMessages[Math.floor(Math.random() * mediocreMessages.length)];
      responseMessage = mediocreMessage.replace('{{amount}}', rewardAmount); // Replace {{amount}} with actual dustollarinos earned
      embedColor = '#f4c542';  // Yellow for mediocre outcome
    }
    // Caught (20% chance)
    else if (randomChance <= 0.90) {
      const lossPercentage = Math.random() * (0.10 - 0.05) + 0.05; // Random between 5% and 10% loss
      const lossAmount = Math.floor(balances[userId] * lossPercentage);
      balances[userId] -= lossAmount;

      const caughtRes = await client.query('SELECT message FROM slut_caught');
      const caughtMessages = caughtRes.rows.map(row => row.message);
      const caughtMessage = caughtMessages[Math.floor(Math.random() * caughtMessages.length)];
      responseMessage = caughtMessage.replace('{{amount}}', lossAmount); // Replace {{amount}} with actual dustollarinos lost
      embedColor = '#ba0230';  // Red for caught (loss)
    }
    // Unattractive (10% chance)
    else {
      const unattractiveRes = await client.query('SELECT message FROM slut_unattractive');
      const unattractiveMessages = unattractiveRes.rows.map(row => row.message);
      const unattractiveMessage = unattractiveMessages[Math.floor(Math.random() * unattractiveMessages.length)];
      responseMessage = unattractiveMessage;
      embedColor = '#000000';  // Black for unattractive (no dustollarinos involved)
    }

    // Update user balance in the database
    const balanceRes = await client.query('SELECT balance FROM balances WHERE user_id = $1', [userId]);
    const userBalance = balanceRes.rows[0] ? balanceRes.rows[0].balance : 0;

    if (!balanceRes.rows[0]) {
      await client.query('INSERT INTO balances (user_id, balance) VALUES ($1, $2)', [userId, rewardAmount]);
    } else {
      await client.query('UPDATE balances SET balance = $1 WHERE user_id = $2', [userBalance + rewardAmount, userId]);
    }

    // Create embed with the response message and the corresponding color
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setDescription(responseMessage)
      .setTimestamp()
      .setFooter({ text: `Your new balance: ${userBalance + rewardAmount} dustollarinos` });  // Add footer showing new balance

    // Send the final response as an embed
    await interaction.reply({ embeds: [embed] });

    // Disconnect from the database
    await client.end();
  },
};
