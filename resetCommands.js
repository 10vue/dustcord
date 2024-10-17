// Import required modules
const { Client, GatewayIntentBits } = require('discord.js');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const token = process.env.TOKEN;
const guildId = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`${client.user.tag} has logged in.`);

  try {
    // Fetch all commands for the specified guild
    const guild = await client.guilds.fetch(guildId);
    const commands = await guild.commands.fetch();

    if (commands.size > 0) {
      // Delete all commands in the guild
      for (const command of commands.values()) {
        await command.delete();
        console.log(`Deleted guild command: ${command.name}`);
      }
      console.log('All guild commands have been deleted.');
    } else {
      console.log('No guild commands to delete.');
    }

  } catch (error) {
    console.error('Error deleting guild commands:', error);
  } finally {
    // Log out of the bot once commands are deleted
    client.destroy();
  }
});

client.login(token);
