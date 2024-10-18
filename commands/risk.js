const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('risk')
    .setDescription('Shows the success chances of all commands.'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor('#ffffff')  // Light blue color for the embed
      .setTitle('Command Success Chances')
      .setDescription('Here are the success chances for each command.')
      .addFields(
        {
          name: 'Slut Command',
          value: `
          - **Success (40%)**: Earn between 500 and 1,500 dustollarinos.
          - **Mediocre (30%)**: Earn between 10 and 100 dustollarinos.
          - **Caught (20%)**: Lose between 5% and 10% of your balance.
          - **Unattractive (10%)**: No dustollarinos involved, just a neutral message.
          `,
        },
        {
          name: 'Crime Command',
          value: `
          - **Jackpot (1%)**: Earn between 80,000 and 120,000 dustollarinos.
          - **Success (19%)**: Earn between 1,500 and 3,000 dustollarinos.
          - **Critical Failure (3%)**: Lose between 50% and 75% of your balance.
          - **Failure (77%)**: Lose between 35% and 45% of your balance.
          `,
        },
        {
          name: 'Rob Command',
          value: `
          - **Base success (51%)**:
          - Success decreases based on the percentage of the target's balance being stolen.
          - **Formula**: \`SuccessChance = 51% - (percentage of target's balance to steal / 2)\`
          `,
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
