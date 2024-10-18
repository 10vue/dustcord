const { Client, GatewayIntentBits, REST, Routes, Collection } = require("discord.js");
const { Client: PGClient } = require("pg"); // PostgreSQL client
const fs = require("fs");
const path = require("path");
require("dotenv").config(); // Load .env file

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Initialize PostgreSQL client globally
const pgClient = new PGClient({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

client.commands = new Collection();

// Path to track previously registered commands
const registeredCommandsFilePath = path.join(__dirname, "registeredCommands.json");

// Function to load previously registered commands with error handling for invalid JSON
function loadPreviouslyRegisteredCommands() {
  try {
    if (fs.existsSync(registeredCommandsFilePath)) {
      const data = fs.readFileSync(registeredCommandsFilePath, 'utf8');
      return JSON.parse(data); // Try parsing the content
    }
    return []; // If file doesn't exist, return an empty array
  } catch (error) {
    console.error('[ERROR] Failed to load registeredCommands.json:', error);
    return []; // Return an empty array if JSON parsing fails
  }
}

// Function to save registered commands with their IDs
function saveRegisteredCommands(commands) {
  fs.writeFileSync(
    registeredCommandsFilePath,
    JSON.stringify(commands, null, 2),
  );
  console.log("Successfully saved registered commands.");
}

// Function to load commands dynamically
async function loadCommands() {
  const commandFiles = fs
    .readdirSync(path.join(__dirname, "commands"))
    .filter((file) => file.endsWith(".js"));
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
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    const currentCommands = await loadCommands();

    // Load previously registered commands with error handling
    let previouslyRegisteredCommands = loadPreviouslyRegisteredCommands();

    // Get the names and full data of current and previously registered commands
    const currentCommandNames = currentCommands.map((cmd) => cmd.name);
    const previousCommandNames = previouslyRegisteredCommands.map(
      (cmd) => cmd.name,
    );

    // Find new commands that aren't registered yet or have changed
    const newOrChangedCommands = currentCommands.filter((cmd) => {
      const matchingOldCommand = previouslyRegisteredCommands.find(
        (oldCmd) => oldCmd.name === cmd.name,
      );
      return !matchingOldCommand || !commandsAreEqual(matchingOldCommand, cmd);
    });

    // Find deleted commands that no longer exist in the current list
    const deletedCommands = previouslyRegisteredCommands.filter(
      (cmd) => !currentCommandNames.includes(cmd.name),
    );

    // Log and delete the deleted commands
    for (const cmd of deletedCommands) {
      if (!cmd.id) {
        console.warn(`[COMMAND WARNING] Command "${cmd.name}" does not have a valid ID, skipping deletion.`);
        continue; // Skip this command if it doesn't have a valid ID
      }

      console.log(`[COMMAND DELETED] Command "${cmd.name}" has been deleted.`);
      // Delete the command from Discord API
      try {
        await rest.delete(
          Routes.applicationGuildCommand(
            process.env.CLIENT_ID,
            process.env.GUILD_ID,
            cmd.id
          )
        );
        console.log(
          `[COMMAND DELETED] Command "${cmd.name}" has been removed from Discord.`
        );
      } catch (error) {
        console.error(`[COMMAND DELETE ERROR] Error deleting command "${cmd.name}":`, error);
      }
    }

    // Remove deleted commands from the registeredCommands.json file
    const updatedRegisteredCommands = previouslyRegisteredCommands.filter(
      (cmd) => currentCommandNames.includes(cmd.name)
    );

    // Save the updated list to the file
    saveRegisteredCommands(updatedRegisteredCommands);

    // Log added/changed commands
    newOrChangedCommands.forEach((cmd) => {
      console.log(
        `[COMMAND UPDATED] New/updated command "${cmd.name}" will be registered.`
      );
    });

    // If there are new or changed commands, register them
    if (newOrChangedCommands.length > 0) {
      console.log(
        "Started registering new/updated guild-specific (/) commands."
      );
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.CLIENT_ID,
          process.env.GUILD_ID,
        ),
        { body: currentCommands },
      );

      // Save the newly registered commands to the file with IDs
      const currentCommandsWithIds = currentCommands.map((cmd) => ({
        ...cmd,
        id: cmd.id || undefined, // Ensure `id` exists for each command
      }));
      saveRegisteredCommands(currentCommandsWithIds);

      console.log(
        "Successfully registered new/updated guild-specific commands."
      );
    } else {
      console.log("No new or updated commands found to register.");
    }

    // Track the updated command list
    const updatedCommandNames = currentCommands.map((cmd) => cmd.name);
    console.log(
      `[COMMAND LIST UPDATED] Current command list: ${updatedCommandNames.join(
        ", ",
      )}`,
    );
  } catch (error) {
    console.error(
      "[ERROR] Error while registering guild-specific commands:",
      error,
    );
  }
}

// Handle interactions (slash commands)
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Connect to PostgreSQL database
  try {
    await pgClient.connect();
    console.log("Connected to PostgreSQL database.");
  } catch (error) {
    console.error("Error connecting to PostgreSQL database:", error);
  }

  // Register new commands only if there are any changes
  await registerNewCommands();
});

// Interaction handler
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);

    await interaction.reply({
      content: "Sorry, this command does not exist.",
      ephemeral: true,
    });
    return;
  }

  try {
    console.log(
      `[COMMAND EXECUTION] ${interaction.user.tag} is executing the ${interaction.commandName} command.`,
    );
    await command.execute(interaction, pgClient); // Pass the pgClient to the command
  } catch (error) {
    console.error(`Error executing command: ${interaction.commandName}`, error);
    await interaction.reply({
      content: "There was an error executing this command!",
      ephemeral: true,
    });
  }
});

// Load and initialize services (including word game)
const servicesFolderPath = path.join(__dirname, 'services');

// Read the files in the 'services' folder and initialize each one
fs.readdirSync(servicesFolderPath).forEach(file => {
  if (file.endsWith('.js')) {
    const servicePath = path.join(servicesFolderPath, file);
    require(servicePath)(client, pgClient);  // Pass both client and pgClient to the service
  }
});

client.login(process.env.DISCORD_TOKEN);
