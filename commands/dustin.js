const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dustin')
    .setDescription('Sends a random image from dustin\'s folder!'),

  async execute(interaction) {
    try {
      // Defer the reply to avoid timeout issues
      await interaction.deferReply();

      // Path to the /dustin folder
      const imagesFolderPath = path.join(__dirname, '../dustin');
      
      // Read the files in the /dustin folder
      const files = fs.readdirSync(imagesFolderPath).filter(file => 
        file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.jpeg')
      );
      
      // If there are no image files in the folder
      if (files.length === 0) {
        return interaction.editReply({ content: 'No images found in the /dustin folder.', ephemeral: true });
      }

      // Pick a random image file
      const randomFile = files[Math.floor(Math.random() * files.length)];

      // Get the full path to the image
      const imagePath = path.join(imagesFolderPath, randomFile);

      // Create the embed
      const embed = new EmbedBuilder()
        .setImage('attachment://' + randomFile) // Set the image from the attachment
        .setFooter({ text: 'Here\'s your Dustin image! Visit https://dustins.cafe/ for credits.' });

      // Send the embed with the image
      await interaction.editReply({
        embeds: [embed],
        files: [imagePath], // Attach the image to the embed
      });
    } catch (error) {
      console.error('Error sending random image:', error);
      await interaction.editReply({ content: 'There was an error fetching the image.', ephemeral: true });
    }
  },
};
