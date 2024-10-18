const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const emojis = {    
  cherry: '🍒',    
  pineapple: '🍍',    
  watermelon: '🍉',    
  grape: '🍇',    
  deer: '🦌',    
  leftSide: '<:slotssideL:1296844124908945479>',    
  rightSide: '<:slotssideR:1296844145163374642>', 
  jackpotLeft: '<:jackpotL:1296844171939807234>', 
  jackpotRight: '<:jackpotR:1296844190906585089>', 
  rolling: [ 
    '<a:rolling5:1296844025923371070>', 
    '<a:rolling4:1296844013474680884>', 
    '<a:rolling3:1296844004045885645>', 
    '<a:rolling2:1296843971468984402>', 
    '<a:rolling1:1296843955090227220>', 
  ], 
}; 

let isSlotInUse = false; // Lock for the slot command

module.exports = { 
  data: new SlashCommandBuilder() 
    .setName('slots') 
    .setDescription('Play the slots!') 
    .addIntegerOption(option => 
      option.setName('bet') 
        .setDescription('Amount to bet on the slots.') 
        .setRequired(true)), // Bet is required 

  async execute(interaction, pgClient) { 
    if (isSlotInUse) {
      return interaction.reply('The slots are currently in use by another player. Please wait for your turn.');
    }

    isSlotInUse = true; // Lock the command for this user

    await interaction.deferReply(); 

    const betAmount = interaction.options.getInteger('bet'); 
    const userId = interaction.user.id; 

    // Validate the bet amount 
    if (betAmount < 100 || betAmount > 10000) { 
      isSlotInUse = false; // Unlock the command
      return interaction.editReply('Please enter a bet amount between **100** and **10,000** dustollarinos.'); 
    } 

    // Check user balance
    const balanceResult = await pgClient.query('SELECT balance FROM balances WHERE user_id = $1', [userId]);
    const userBalance = balanceResult.rows[0] ? balanceResult.rows[0].balance : 0;

    if (userBalance < betAmount) {
      isSlotInUse = false; // Unlock the command
      return interaction.editReply(`You do not have enough balance to place this bet. Your current balance is **${userBalance} dustollarinos**.`);
    }

    // Deduct the bet amount from the user's balance
    await pgClient.query('UPDATE balances SET balance = balance - $1 WHERE user_id = $2', [betAmount, userId]);

    // Spin the slots 
    const spinResult = spinSlots(); 
    const winnings = calculateWinnings(spinResult, betAmount); 

    // Update the jackpot
    if (winnings === 0) { 
      await updateJackpot(pgClient, betAmount); // Add to jackpot 
    } else { 
      await pgClient.query('INSERT INTO balances (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = balances.balance + $2', 
        [userId, winnings]); 
    } 

    // Build the initial message with rolling emojis 
    const initialMessage = getSlotMessage(true); 
     
    // Send the initial message with rolling emojis 
    const message = await interaction.editReply(initialMessage); 

    // Wait for 1 second before updating 
    await delay(1000); 

    // Update the message column by column 
    for (let step = 1; step <= 4; step++) { 
      await updateSlotMessage(message, spinResult, step); 
      await delay(500); // Half a second between each step 
    } 

    // Create the info embed for additional information 
    const infoEmbed = new EmbedBuilder() 
      .setColor('#e3c207') 
      .setTitle(' Slots Result ') // Updated title 
      .setDescription(`**Your Bet:** ${betAmount} dustollarinos\n\n` + 
        (winnings > 0 ? `**You Win:** ${winnings} dustollarinos!` : `**You Lose!** Your bet has been added to the jackpot.`))
      .setFooter({ text: `Total Jackpot: ${await getJackpotTotal(pgClient)} dustollarinos` });

    // Send the information embed
    await interaction.followUp({ embeds: [infoEmbed] });

    isSlotInUse = false; // Unlock the command
  },
};

// Function to simulate spinning the slots
function spinSlots() {
  const rows = [
    [emojis.leftSide, getRandomEmoji(), getRandomEmoji(), getRandomEmoji(), emojis.rightSide],
    [emojis.jackpotLeft, getRandomEmoji(), getRandomEmoji(), getRandomEmoji(), emojis.jackpotRight],
    [emojis.leftSide, getRandomEmoji(), getRandomEmoji(), getRandomEmoji(), emojis.rightSide],
  ];
  return rows;
}

// Function to get a random emoji from the available options
function getRandomEmoji() {
  const resultEmojis = [emojis.cherry, emojis.pineapple, emojis.watermelon, emojis.grape, emojis.deer];
  const randomIndex = Math.floor(Math.random() * resultEmojis.length);
  return resultEmojis[randomIndex];
}

// Function to create the slot message
function getSlotMessage(initial) {
  // Initialize the slots with rolling emojis
  const rows = [
    [emojis.leftSide, initial ? getRandomRollingEmoji() : getRandomEmoji(), initial ? getRandomRollingEmoji() : getRandomEmoji(), initial ? getRandomRollingEmoji() : getRandomEmoji(), emojis.rightSide],
    [emojis.jackpotLeft, initial ? getRandomRollingEmoji() : getRandomEmoji(), initial ? getRandomRollingEmoji() : getRandomEmoji(), initial ? getRandomRollingEmoji() : getRandomEmoji(), emojis.jackpotRight],
    [emojis.leftSide, initial ? getRandomRollingEmoji() : getRandomEmoji(), initial ? getRandomRollingEmoji() : getRandomEmoji(), initial ? getRandomRollingEmoji() : getRandomEmoji(), emojis.rightSide],
  ];

  // Construct the message string
  return rows.map(row => row.join(' ')).join('\n');
}

// Function to get a random rolling emoji from the rolling ones
function getRandomRollingEmoji() {
  const randomIndex = Math.floor(Math.random() * emojis.rolling.length);
  return emojis.rolling[randomIndex];
}

// Function to update the message step by step by column
async function updateSlotMessage(message, spinResult, step) {
  // Prepare the updated rows with rolling emojis
  const updatedRows = [
    [emojis.leftSide], // Left side emoji
    [emojis.jackpotLeft], // Jackpot left side emoji
    [emojis.leftSide], // Left side emoji
  ];

  // Fill the rows based on the spin results and the step
  for (let row = 0; row < 3; row++) {
    // Fill the rolling emojis up to the current step
    for (let col = 0; col < 3; col++) {
      if (col < step) {
        updatedRows[row].push(spinResult[row][col + 1]); // Use actual result (ignoring sides)
      } else {
        updatedRows[row].push(getRandomRollingEmoji()); // Keep random rolling for other positions
      }
    }
    // Add the right side emoji
    updatedRows[row].push(row === 1 ? emojis.jackpotRight : emojis.rightSide); // Jackpot right for the jackpot row, right side for others
  }

  const messageContent = updatedRows.map(row => row.join(' ')).join('\n');

  // Edit the message to show the updated slot state
  await message.edit(messageContent);
}

// Function to calculate winnings based on the middle row
function calculateWinnings(spinResult, betAmount) {
  const middleRow = spinResult[1]; // Get the middle row

  // Check if all emojis in the middle row (excluding the sides) are the same
  const middleEmojis = middleRow.slice(1, -1); // Remove the sides
  if (middleEmojis.every(emoji => emoji === middleEmojis[0])) {
    switch (middleEmojis[0]) {
      case emojis.cherry:
        return Math.floor(betAmount * 1.5);
      case emojis.grape:
        return betAmount * 2;
      case emojis.watermelon:
        return betAmount * 3;
      case emojis.pineapple:
        return betAmount * 5;
      case emojis.deer:
        const totalWinnings = getJackpotTotal(pgClient); // Get current jackpot total
        resetJackpot(pgClient); // Reset the jackpot after winning
        return totalWinnings;
    }
  }

  return 0; // No winnings
}

// Function to update the jackpot
async function updateJackpot(pgClient, amount) {
  await pgClient.query('INSERT INTO jackpot (id, total) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET total = jackpot.total + $2', [1, amount]);
}

// Function to get the current jackpot total
async function getJackpotTotal(pgClient) {
  const result = await pgClient.query('SELECT total FROM jackpot WHERE id = $1', [1]);
  return result.rows[0] ? result.rows[0].total : 0; // Return 0 if no entry exists
}

// Function to reset the jackpot after a win
async function resetJackpot(pgClient) {
  await pgClient.query('UPDATE jackpot SET total = 0 WHERE id = $1', [1]);
}

// Function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
