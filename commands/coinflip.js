const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Bet on a coin flip!')
    .addIntegerOption(option =>
      option.setName('bet')
        .setDescription('Amount to bet')
        .setRequired(true)),

  async execute(interaction, pgClient) { // Accept pgClient as a parameter
    const userId = interaction.user.id;
    const betAmount = interaction.options.getInteger('bet');

    try {
      // Query the user's balance from the database
      const balanceRes = await pgClient.query('SELECT balance FROM balances WHERE user_id = $1', [userId]);

      let userBalance = balanceRes.rows.length ? balanceRes.rows[0].balance : 0;

      // Check if the user has enough dustollarinos to bet
      if (userBalance < betAmount || betAmount <= 0) {
        return interaction.reply({ content: 'You do not have enough dustollarinos to make this bet!' });
      }

      // Decrease the user's balance by the bet amount
      userBalance -= betAmount;

      // dustollarino flip embed: dustollarino is in the air
      const dustollarinoFlipEmbed = new EmbedBuilder()
        .setColor('#e3c207')  // dustollarino in the air color
        .setTitle('The dustollarino is in the air! Call it!')
        .setDescription(`Bet: **${betAmount} dustollarinos**`);

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('heads')
            .setLabel('Heads')
            .setStyle(ButtonStyle.Success), // Green for Heads
          new ButtonBuilder()
            .setCustomId('tails')
            .setLabel('Tails')
            .setStyle(ButtonStyle.Success) // Green for Tails
        );

      // Defer the reply so we can send a follow-up
      await interaction.deferReply();

      // Send the dustollarino flip message with buttons
      await interaction.editReply({
        embeds: [dustollarinoFlipEmbed],
        components: [row]
      });

      // Define filter to ensure only the user who started the flip can interact
      const filter = (buttonInteraction) => buttonInteraction.user.id === interaction.user.id;

      // Set up collector for Heads/Tails choice
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 10000 });

      collector.on('collect', async (choiceInteraction) => {
        const userChoice = choiceInteraction.customId;
        const dustollarinoFlip = Math.random() < 0.5 ? 'heads' : 'tails';

        let resultMessage;
        let resultColor;

        // Determine win or lose
        if (dustollarinoFlip === userChoice) {
          userBalance += betAmount * 2;  // Double the bet amount for win
          resultMessage = `You flipped **${dustollarinoFlip}** and won!`;
          resultColor = '#02ba11';  // Green for win
        } else {
          resultMessage = `You flipped **${dustollarinoFlip}** and lost!`;
          resultColor = '#ba0230';  // Red for loss
        }

        // Update the user's balance in the database
        await pgClient.query('INSERT INTO balances (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = $2', [userId, userBalance]);

        // Send result message and disable buttons
        await choiceInteraction.update({
          embeds: [new EmbedBuilder()
            .setColor(resultColor)
            .setDescription(`${resultMessage} You now have **${userBalance} dustollarinos**.`)
            .setFooter({ text: `New balance: ${userBalance} dustollarinos.` })
            .setTimestamp()
          ],
          components: [],
        });

        collector.stop();
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
          // Deduct 1 dustollarino for timeout penalty
          userBalance = Math.max(userBalance - 1, 0);
          await pgClient.query('UPDATE balances SET balance = $2 WHERE user_id = $1', [userId, userBalance]);

          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor('#000000')
              .setDescription(`You didn't call it in time... The dustollarino rolled into a sewer grate and you lost 1 dustollarino. You now have **${userBalance} dustollarinos**.`)
              .setFooter({ text: `New balance: ${userBalance} dustollarinos.` })
              .setTimestamp()
            ],
            components: [],
          });
        }
      });

    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'There was an error processing your bet. Please try again later.' });
    }
  },
};
