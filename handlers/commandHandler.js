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

// Handle interactions (slash commands)
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return interaction.reply({
      content: "This command does not exist.",
      ephemeral: true,
    });
  }

  try {
    console.log(
      `[COMMAND EXECUTION] ${interaction.user.tag} is executing the ${interaction.commandName} command.`
    );
    await command.execute(interaction, pgClient); // Pass pgClient to the command
  } catch (error) {
    console.error(`Error executing command: ${interaction.commandName}`, error);
    await interaction.reply({
      content: "There was an error while executing this command.",
      ephemeral: true,
    });
  }
});

module.exports = { loadCommands, handleInteraction };
