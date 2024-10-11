const fs = require('fs');
const path = require('path');

// Function to load commands from the 'commands' folder
async function loadCommands(client) {
  const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
  
  // Loop through each command file and require it
  for (const file of commandFiles) {
    const command = require(path.join(__dirname, '../commands', file));
    client.commands.set(command.data.name, command);  // Store command in client.commands map
  }

  console.log('Successfully loaded application commands.');
}

// Function to handle interactions (slash commands)
async function handleInteraction(interaction) {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;
  const command = interaction.client.commands.get(commandName);

  if (!command) {
    console.error(`[ERROR] Command not found: ${commandName}`);
    return;
  }

  try {
    // Execute the command
    await command.execute(interaction);
  } catch (error) {
    console.error(`[ERROR] Error executing command ${commandName}:`, error);
    await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
  }
}

module.exports = { loadCommands, handleInteraction };
