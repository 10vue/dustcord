const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Path to balances.json file
const balancesFilePath = path.join(__dirname, '../data/balances.json');

// Function to read balances from the JSON file
function readBalances() {
  if (fs.existsSync(balancesFilePath)) {
    return JSON.parse(fs.readFileSync(balancesFilePath, 'utf8'));
  } else {
    return {};
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Bet on a coin flip!')
    .addIntegerOption(option =>
      option.setName('bet')
        .setDescription('Amount to bet')
        .setRequired(true)),

  async execute(interaction) {
    let balances = readBalances();
    const userId = interaction.user.id;
    const betAmount = interaction.options.getInteger('bet');

    if (!balances[userId]) {
      balances[userId] = 0;
    }

    const userBalance = balances[userId];

    // Check if the user has enough coins to bet
    if (userBalance < betAmount || betAmount <= 0) {
      return interaction.reply({ content: 'You do not have enough coins to make this bet!' });
    }

    // Decrease the user's balance by the bet amount
    balances[userId] -= betAmount;
    fs.writeFileSync(balancesFilePath, JSON.stringify(balances, null, 2));

    // Coin flip embed: Coin is in the air
    const coinFlipEmbed = new EmbedBuilder()
      .setColor('#e3c207')  // Coin in the air color
      .setTitle('The coin is in the air! Call it!')
      .setDescription(`Bet: **${betAmount} coins**`);

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

    // Send the coin flip message with buttons
    await interaction.editReply({
      embeds: [coinFlipEmbed],
      components: [row]
    });

    // Define filter to ensure only the user who started the coinflip can interact
    const filter = (buttonInteraction) => buttonInteraction.user.id === interaction.user.id;

    // Set up collector for Heads/Tails choice
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 10000 });

    collector.on('collect', async (choiceInteraction) => {
      const userChoice = choiceInteraction.customId;
      const coinFlip = Math.random() < 0.5 ? 'heads' : 'tails';

      let resultMessage;
      let resultColor;
      let amountWonLost = 0;

      // Determine win or lose
      if (coinFlip === userChoice) {
        balances[userId] += betAmount * 2; // Double the bet amount for win
        resultMessage = `You flipped **${coinFlip}** and won!`;
        resultColor = '#02ba11'; // Green for win
        amountWonLost = betAmount * 2; // Amount won
      } else {
        resultMessage = `You flipped **${coinFlip}** and lost!`;
        resultColor = '#ba0230'; // Red for loss
        amountWonLost = -betAmount; // Amount lost
      }

      // Save updated balance to the file
      fs.writeFileSync(balancesFilePath, JSON.stringify(balances, null, 2));

      // Get the timestamp of the transaction
      const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Pacific/Auckland' });

      // Send result message and disable buttons (public)
      await choiceInteraction.update({
        embeds: [new EmbedBuilder()
          .setColor(resultColor)
          .setDescription(`${resultMessage} You now have **${balances[userId]} coins**.`)
          .setFooter({ text: `New balance: ${balances[userId]} coins.` })
          .setTimestamp()
        ],
        components: [],
      });

      collector.stop();
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        balances[userId] = Math.max(balances[userId] - 1, 0);  // Penalize the user by 1 coin if they don't respond in time
        fs.writeFileSync(balancesFilePath, JSON.stringify(balances, null, 2));

        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#000000')
            .setDescription(`You didn't call it in time... The coin rolled into a sewer grate and you lost 1 coin. You now have **${balances[userId]} coins**.`)
            .setFooter({ text: `New balance: ${balances[userId]} coins.` })
            .setTimestamp()
          ],
          components: [],
        });
      }
    });
  },
};
