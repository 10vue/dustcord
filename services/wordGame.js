const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file

module.exports = (client, pgClient) => {
  // Load the word list from data/words.json file
  const wordsFilePath = path.join(__dirname, '../data/words.json'); // Adjusted to point to data folder
  const words = JSON.parse(fs.readFileSync(wordsFilePath, 'utf8')); // Read and parse the word list
  let currentWord = '';
  let currentGroup = '';
  let gameInProgress = false;
  let winnerDeclared = false;
  let gameMessage = null; // Variable to store the game message

  // Get the channel ID from environment variables
  const WORDGAMECHANNEL_ID = process.env.WORDGAMECHANNEL_ID; // Make sure this is set in your .env file

  // Function to start a new round of the word game
  async function startWordGame() {
    if (gameInProgress) return; // Don't start a new round if one is already in progress

    gameInProgress = true;
    winnerDeclared = false;

    // Pick a random word from the list
    const randomWord = words[Math.floor(Math.random() * words.length)];
    currentWord = randomWord.word;
    currentGroup = randomWord.group;

    // Scramble the word
    const scrambledWord = scrambleWord(currentWord);

    // Check if the group starts with a vowel (case insensitive)
    const article = startsWithVowel(currentGroup) ? 'an' : 'a';

    // Announce the word game
    const channel = client.channels.cache.get(WORDGAMECHANNEL_ID); // Use the channel ID from .env
    if (!channel) {
      console.error('Channel not found! Please check the channel ID.');
      return;
    }

    // Convert hex color to integer using Discord.js Color
    const colorHex = '#e3c207';
    const colorInt = parseInt(colorHex.replace('#', ''), 16); // Use integer directly for Discord.js v14

    // Create the word game embed
    const gameEmbed = new EmbedBuilder()
      .setColor(colorInt) // Use the integer value for color
      .setTitle('Word Game: Type the word to win!')
      .setDescription(`**Unscramble this word**: **${scrambledWord}**\n\n**Type** the word to win **1000 dustollarinos**! You have 30 seconds!`)
      .setFooter({ text: `Hint: It's ${article} ${currentGroup} based word.` });

    // Send the word game message and store the reference
    gameMessage = await channel.send({ embeds: [gameEmbed] });

    // Start the timer for the round (30 seconds to guess)
    setTimeout(async () => {
      if (!winnerDeclared) {
        // If no one has won, edit the message to indicate time's up and reveal the word
        const timeUpEmbed = new EmbedBuilder()
          .setColor('#FF0000') // Red color for time's up
          .setTitle('Time\'s up!')
          .setDescription('No one typed the correct word in time. Better luck next round!')
          .setFooter({ text: `The correct word was: ${currentWord}` }); // Show the correct word

        await gameMessage.edit({ embeds: [timeUpEmbed] });
        gameInProgress = false; // Reset game
      }
    }, 30000); // 30000 ms = 30 seconds timer for the word game
  }

  // Function to scramble a word
  function scrambleWord(word) {
    const wordArray = word.split('');
    for (let i = wordArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wordArray[i], wordArray[j]] = [wordArray[j], wordArray[i]]; // Swap elements
    }
    return wordArray.join('');
  }

  // Function to check if the group starts with a vowel
  function startsWithVowel(group) {
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    return vowels.includes(group.charAt(0).toLowerCase());
  }

  // Listen for messages to check if someone types the correct word
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !gameInProgress) return; // Ignore bot messages and if no game is in progress

    const userMessage = message.content.toLowerCase().trim();

    // Check if the message matches the word and no winner has been declared
    if (userMessage === currentWord && !winnerDeclared) {
      winnerDeclared = true;

      // Reward the winner with 1000 dustollarinos
      try {
        await pgClient.query('UPDATE balances SET balance = balance + $1 WHERE user_id = $2', [1000, message.author.id]);

        // Create a winner embed
        const winnerEmbed = new EmbedBuilder()
          .setColor('#02ba11') // Green for a win
          .setTitle('Congratulations!')
          .setDescription(`**${message.author.username}** won the prize by typing "**${currentWord}**" correctly and won **1000 dustollarinos**!`)
          .setFooter({ text: 'Good luck in the next round!' })
          .setTimestamp();

        // Edit the original message to announce the winner
        await gameMessage.edit({ embeds: [winnerEmbed] });
      } catch (error) {
        console.error('Error updating balance:', error);
      } finally {
        // Reset the game
        gameInProgress = false;
      }
    }
  });

  // Start the game loop every hour
  setInterval(() => {
    startWordGame(); // Start the game every hour
  }, 3600000); // 3600000 ms = 60 minutes

  // Start the first round when the bot comes online
  client.once('ready', () => {
    startWordGame(); // Start the first word game immediately when the bot is online
  });
};
