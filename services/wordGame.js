const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file

module.exports = (client, pgClient) => {
  const wordsFilePath = path.join(__dirname, '../data/words.json');
  const words = JSON.parse(fs.readFileSync(wordsFilePath, 'utf8'));
  let currentWord = '';
  let currentGroup = '';
  let gameInProgress = false;
  let winnerDeclared = false;
  let gameMessage = null;

  const WORDGAMECHANNEL_ID = process.env.WORDGAMECHANNEL_ID;

  async function startWordGame() {
    if (gameInProgress) return;

    gameInProgress = true;
    winnerDeclared = false;

    const randomWord = words[Math.floor(Math.random() * words.length)];
    currentWord = randomWord.word;
    currentGroup = randomWord.group;

    const scrambledWord = scrambleWord(currentWord);
    const article = startsWithVowel(currentGroup) ? 'an' : 'a';

    const channel = client.channels.cache.get(WORDGAMECHANNEL_ID);
    if (!channel) {
      console.error('Channel not found! Please check the channel ID.');
      return;
    }

    const colorInt = parseInt('#e3c207'.replace('#', ''), 16);

    const gameEmbed = new EmbedBuilder()
      .setColor(colorInt)
      .setTitle('Word Game: Type the word to win!')
      .setDescription(`**Unscramble this word**: **${scrambledWord}**\n\n**Type** the word to win **1000 dustollarinos**! You have 30 seconds!`)
      .setFooter({ text: `Hint: It's ${article} ${currentGroup} based word.` });

    gameMessage = await channel.send({ embeds: [gameEmbed] });

    setTimeout(async () => {
      if (!winnerDeclared) {
        const timeUpEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('Time\'s up!')
          .setDescription('No one typed the correct word in time. Better luck next round!')
          .setFooter({ text: `The correct word was: ${currentWord}` });

        await gameMessage.edit({ embeds: [timeUpEmbed] });
        gameInProgress = false;

        // Set a timer to delete the message after 1 minute
        setTimeout(async () => {
          if (gameMessage) {
            try {
              await gameMessage.delete(); // Delete the message after 1 minute
            } catch (error) {
              console.error('Failed to delete the game message:', error);
            }
          }
        }, 60000); // 1 minute = 60000 ms
      }
    }, 30000); // 30 seconds for the word guessing period
  }

  function scrambleWord(word) {
    const wordArray = word.split('');
    for (let i = wordArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wordArray[i], wordArray[j]] = [wordArray[j], wordArray[i]];
    }
    return wordArray.join('');
  }

  function startsWithVowel(group) {
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    return vowels.includes(group.charAt(0).toLowerCase());
  }

  client.on('messageCreate', async (message) => {
    if (message.author.bot || !gameInProgress) return;

    const userMessage = message.content.toLowerCase().trim();

    if (userMessage === currentWord && !winnerDeclared) {
      winnerDeclared = true;

      try {
        await pgClient.query('UPDATE balances SET balance = balance + $1 WHERE user_id = $2', [1000, message.author.id]);

        const winnerEmbed = new EmbedBuilder()
          .setColor('#02ba11')
          .setTitle('Congratulations!')
          .setDescription(`**${message.author.username}** won the prize by typing "**${currentWord}**" correctly and won **1000 dustollarinos**!`)
          .setFooter({ text: 'Good luck in the next round!' })
          .setTimestamp();

        await gameMessage.edit({ embeds: [winnerEmbed] });
      } catch (error) {
        console.error('Error updating balance:', error);
      } finally {
        gameInProgress = false;
      }
    }
  });

  function scheduleWordGame() {
    const now = new Date();
    const minutes = now.getMinutes();

    let nextStart;
    if (minutes < 30) {
      nextStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 30, 0);
    } else {
      nextStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);
    }

    const timeUntilNextStart = nextStart - now;

    setTimeout(() => {
      startWordGame();
      scheduleWordGame();
    }, timeUntilNextStart);
  }

  client.once('ready', () => {
    scheduleWordGame();
  });
};
