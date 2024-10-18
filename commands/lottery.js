const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

let lotteryInProgress = false;  // Flag to track if a lottery is in progress
let hostMessage = null;  // Store the current host message for updating
let bets = new Map();  // Store bets as a map of userId => bet amount
let totalBets = 0;  // Total bet amount
let countdownTimer = 30;  // Countdown timer for the lottery

// Function to check if a user has enough balance to place a bet
async function canUserBet(pgClient, userId, betAmount) {
  try {
    const res = await pgClient.query('SELECT balance FROM balances WHERE user_id = $1', [userId]);
    return res.rows.length > 0 && res.rows[0].balance >= betAmount;
  } catch (error) {
    console.error('Error checking user balance:', error);
    return false;
  }
}

// Start a new lottery (this will be triggered when the first bet is placed)
async function startLottery(interaction, pgClient, betAmount = 0, userId = null) {
  if (lotteryInProgress) {
    return interaction.reply('A lottery is already in progress. Please wait until it ends.');
  }

  // Lottery can start with only 1 participant, but it requires 2 to spin
  lotteryInProgress = true;  // Mark lottery as in progress

  // Create the host message for the new lottery
  hostMessage = await interaction.channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('Lottery is about to start!')
      .setColor('#e3c207')  // Set color to #e3c207
      .setDescription(`The lottery will spin in **30 seconds**!`)
      .addFields(
        { name: 'Participants:', value: `There are ${bets.size} participant(s).` },
        { name: 'Current Bets:', value: userId && betAmount ? getBetsList() : 'No bets placed yet.' }
      )]
  });

  // If the first bet is placed while starting the lottery, update the bets list
  if (userId && betAmount > 0) {
    bets.set(userId, betAmount);
    totalBets += betAmount;

    await hostMessage.edit({
      embeds: [new EmbedBuilder()
        .setTitle('Lottery is about to start!')
        .setColor('#e3c207')  // Set color to #e3c207
        .setDescription(`The lottery will spin in **30 seconds**!`)
        .addFields(
          { name: 'Participants:', value: `There are ${bets.size} participant(s).` },
          { name: 'Current Bets:', value: getBetsList() }
        )]
    });
  }

  // Start the countdown timer
  let countdown = countdownTimer;
  const countdownInterval = setInterval(async () => {
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      if (bets.size >= 2) {
        await spinWheel(interaction, pgClient);  // Spin the wheel when the countdown ends
      } else {
        // If less than 2 participants, refund bets and reset the lottery
        await refundBets(pgClient);
        interaction.channel.send('You need 2 participants to play.');
        updateHostMessage('Lottery canceled due to insufficient participants.', '#000000');
        resetLottery();
      }
    } else {
      // Update the host message with the countdown
      await hostMessage.edit({
        embeds: [new EmbedBuilder()
          .setTitle('Lottery is about to start!')
          .setColor('#e3c207')  // Set color to #e3c207
          .setDescription(`The lottery will spin in **${countdown} seconds**!`)
          .addFields(
            { name: 'Participants:', value: `There are ${bets.size} participant(s).` },
            { name: 'Current Bets:', value: getBetsList() }
          )]
      });
      countdown -= 5;  // Countdown every 5 seconds
    }
  }, 5000);  // Update every 5 seconds
}

// Function to handle placing a bet
async function placeBet(interaction, pgClient, betAmount) {
  const userId = interaction.user.id;

  // Check if the user has enough balance to place the bet
  if (!await canUserBet(pgClient, userId, betAmount)) {
    return interaction.reply(`You don't have enough balance to place a bet of **${betAmount} dustollarinos**.`);
  }

  // Deduct the bet amount from the user's balance in the database
  await pgClient.query('UPDATE balances SET balance = balance - $1 WHERE user_id = $2', [betAmount, userId]);

  // If this is the first bet, start the lottery
  if (!lotteryInProgress) {
    startLottery(interaction, pgClient, betAmount, userId);
  } else {
    // If the lottery is in progress, accumulate the bet to the user's total bet
    if (bets.has(userId)) {
      bets.set(userId, bets.get(userId) + betAmount);  // Accumulate bet
    } else {
      bets.set(userId, betAmount);  // New bet
    }
    totalBets += betAmount;

    // Update the host message with new bets
    await hostMessage.edit({
      embeds: [new EmbedBuilder()
        .setTitle('Lottery is about to start!')
        .setColor('#e3c207')  // Set color to #e3c207
        .setDescription(`The lottery will spin in **30 seconds**!`)
        .addFields(
          { name: 'Participants:', value: `There are ${bets.size} participant(s).` },
          { name: 'Current Bets:', value: getBetsList() }
        )]
    });
  }

  return interaction.reply(`Your bet of **${betAmount} dustollarinos** has been placed!`);
}

// Function to calculate the winner by weighted random pick
async function spinWheel(interaction, pgClient) {
  // Calculate total bets and weighted chances
  const userIds = [...bets.keys()];
  const weights = userIds.map(userId => bets.get(userId));
  const totalWeight = weights.reduce((acc, weight) => acc + weight, 0);

  // Simulate spinning the wheel
  const randomPick = Math.random() * totalWeight;
  let cumulativeWeight = 0;
  let winnerId = null;

  for (let i = 0; i < userIds.length; i++) {
    cumulativeWeight += weights[i];
    if (randomPick < cumulativeWeight) {
      winnerId = userIds[i];
      break;
    }
  }

  const totalPrize = totalBets;

  // Award the winner by updating their balance in the database
  await pgClient.query('UPDATE balances SET balance = balance + $1 WHERE user_id = $2', [totalPrize, winnerId]);

  // Announce the winner
  const winnerUser = await interaction.client.users.fetch(winnerId);
  const winnerEmbed = new EmbedBuilder()
    .setColor('#000000')  // Set color to black
    .setDescription(`${winnerUser.username} won the lottery with a bet of **${bets.get(winnerId)} dustollarinos**! They win **${totalPrize} dustollarinos**.`);

  await interaction.channel.send({ embeds: [winnerEmbed] });

  // Update the host message to indicate the lottery has finished
  updateHostMessage('Lottery has ended. The winner has been selected.', '#000000');
  resetLottery();
}

// Refund all bets if there aren't enough participants
async function refundBets(pgClient) {
  for (const [userId, betAmount] of bets) {
    await pgClient.query('UPDATE balances SET balance = balance + $1 WHERE user_id = $2', [betAmount, userId]);
  }
}

// Reset lottery variables for the next round
function resetLottery() {
  lotteryInProgress = false;
  bets.clear();
  totalBets = 0;
  hostMessage = null;
}

// Function to update the host message (win or cancellation)
async function updateHostMessage(description, color) {
  await hostMessage.edit({
    embeds: [new EmbedBuilder()
      .setTitle('Lottery has ended')
      .setColor(color)  // Set color to black for end state
      .setDescription(description)
      .addFields(
        { name: 'Participants:', value: getBetsList() }
      )]
  });
}

// Get the formatted list of bets
function getBetsList() {
  return [...bets.entries()].map(([userId, betAmount]) => `<@${userId}>: ${betAmount} dustollarinos`).join('\n') || 'No bets placed yet.';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lottery')
    .setDescription('Start or participate in a lottery.')
    .addIntegerOption(option =>
      option.setName('bet')
        .setDescription('The amount you want to bet on the lottery')
        .setRequired(true)),
  async execute(interaction, pgClient) {
    const betAmount = interaction.options.getInteger('bet');
    const userId = interaction.user.id;

    await placeBet(interaction, pgClient, betAmount); // Place the bet and handle lottery flow
  },
};
