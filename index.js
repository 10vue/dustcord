const { Client, GatewayIntentBits, REST, Routes, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.commands = new Collection();

// Path to track previously registered commands
const registeredCommandsFilePath = path.join(__dirname, 'registeredCommands.json');

// Function to load commands dynamically
async function loadCommands() {
  const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
  const commands = [];

  for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
    console.log(`Loaded command: ${command.data.name}`);
  }

  return commands;
}

// Function to check if the command structures differ
function commandsAreEqual(oldCommand, newCommand) {
  return JSON.stringify(oldCommand) === JSON.stringify(newCommand);
}

// Function to check and register new commands
async function registerNewCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    const currentCommands = await loadCommands();

    // Read previously registered commands from file
    let previouslyRegisteredCommands = [];
    if (fs.existsSync(registeredCommandsFilePath)) {
      previouslyRegisteredCommands = JSON.parse(fs.readFileSync(registeredCommandsFilePath));
    }

    // Get the names and full data of current and previously registered commands
    const currentCommandNames = currentCommands.map(cmd => cmd.name);
    const previousCommandNames = previouslyRegisteredCommands.map(cmd => cmd.name);

    // Find new commands that aren't registered yet or have changed
    const newOrChangedCommands = currentCommands.filter(cmd => {
      const matchingOldCommand = previouslyRegisteredCommands.find(oldCmd => oldCmd.name === cmd.name);
      return !matchingOldCommand || !commandsAreEqual(matchingOldCommand, cmd);
    });

    // Find deleted commands that no longer exist in the current list
    const deletedCommands = previouslyRegisteredCommands.filter(cmd => !currentCommandNames.includes(cmd.name));

    // Log deleted commands
    for (const cmd of deletedCommands) {
      console.log(`[COMMAND DELETED] Command "${cmd.name}" has been deleted.`);
      // Delete the command from Discord API
      await rest.delete(Routes.applicationGuildCommand(config.clientId, config.guildId, cmd.id));
      console.log(`[COMMAND DELETED] Command "${cmd.name}" has been removed from Discord.`);
    }

    // Log added/changed commands
    newOrChangedCommands.forEach(cmd => {
      console.log(`[COMMAND UPDATED] New/updated command "${cmd.name}" will be registered.`);
    });

    // If there are new or changed commands, register them
    if (newOrChangedCommands.length > 0) {
      console.log('Started registering new/updated guild-specific (/) commands.');
      await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: currentCommands });

      // Save the newly registered commands to the file
      fs.writeFileSync(registeredCommandsFilePath, JSON.stringify(currentCommands, null, 2));

      console.log('Successfully registered new/updated guild-specific commands.');
    } else {
      console.log('No new or updated commands found to register.');
    }

    // Track the updated command list
    const updatedCommandNames = currentCommands.map(cmd => cmd.name);
    console.log(`[COMMAND LIST UPDATED] Current command list: ${updatedCommandNames.join(', ')}`);
  } catch (error) {
    console.error('[ERROR] Error while registering guild-specific commands:', error);
  }
}

// Handle interactions (slash commands)
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Register new commands only if there are any changes
  await registerNewCommands();
});

// Interaction handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);

    // Try to register the command dynamically if it is not found
    const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
    const commandFile = commandFiles.find(file => {
      const cmd = require(`./commands/${file}`);
      return cmd.data.name === interaction.commandName;
    });

    if (commandFile) {
      const command = require(`./commands/${commandFile}`);
      await registerNewCommands(); // Register the new command dynamically
      client.commands.set(command.data.name, command); // Add it to the commands collection

      // Reply to user after registering the new command
      await interaction.reply({ content: `Command "${interaction.commandName}" was not registered. It has been registered now!`, ephemeral: true });
    } else {
      await interaction.reply({ content: 'Sorry, this command does not exist.', ephemeral: true });
    }
    return;
  }

  try {
    console.log(`[COMMAND EXECUTION] ${interaction.user.tag} is executing the ${interaction.commandName} command.`);
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing command: ${interaction.commandName}`, error);
    await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
  }
});

client.login(config.token);

// Listen for message events
client.on('messageCreate', async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if both "oh" and "deer" are in the message
  if (message.content.toLowerCase().includes('oh') && message.content.toLowerCase().includes('deer')) {
    // Respond with "shut the hell up" if both words are found
    await message.reply('shut the FUCK up');
  }
});