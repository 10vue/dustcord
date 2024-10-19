const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js'); // Use EmbedBuilder instead of MessageEmbed

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots-payouts')
    .setDescription('View the slot machine payouts'),

  async execute(interaction) {
    // Create the embed for the payouts
    const payoutsEmbed = new EmbedBuilder() // Use EmbedBuilder for creating the embed
      .setColor('#FFD700') // Gold color for the embed
      .setTitle('🎰 Slot Machine Payouts 🎰')
      .addFields(
        { name: '**2 Matching Emojis in the Middle Row**', value: '🍒🍒: **0.5x**\n🍇🍇: **1.2x**\n🍉🍉: **1.5x**\n🍍🍍: **2x**\n🦌🦌: **5x**', inline: true },
        { name: '**3 Matching Emojis in the Middle Row**', value: '🍒🍒🍒: **10x**\n🍇🍇🍇: **20x**\n🍉🍉🍉: **35x**\n🍍🍍🍍: **70x**\n🦌🦌🦌: **JACKPOT**', inline: true }
      )
      .setFooter({ text: 'Good luck! 🍀', iconURL: 'https://emoji.gg/assets/emoji/7073_lucky_clover.png' }) // Footer with clover emoji
      .setTimestamp(); // Timestamp to show when the payouts were shown

    // Send the payouts message as an ephemeral embedded reply
    await interaction.reply({
      embeds: [payoutsEmbed],
      ephemeral: true, // This makes the message ephemeral (only visible to the user)
    });
  },
};
