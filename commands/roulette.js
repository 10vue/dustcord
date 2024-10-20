const { SlashCommandBuilder } = require('discord.js');

const emojis = {
    whiteSquare: ':white_large_square:',
    blackSquare: ':black_large_square:',
    redSquare: ':red_square:',
    greenSquare: ':green_square:',
    arrowDown: ':arrow_down_small:',
};

// Define the fixed roulette pattern
const roulettePattern = [
    emojis.redSquare, emojis.blackSquare, emojis.redSquare, 
    emojis.blackSquare, emojis.greenSquare
];

let isRouletteInUse = false; // Lock for the roulette command

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Spin the roulette wheel!'),

    async execute(interaction) {
        if (isRouletteInUse) {
            return interaction.reply('The roulette wheel is currently in use. Please wait for your turn.');
        }

        isRouletteInUse = true; // Lock the command for this user

        await interaction.deferReply();

        const animationDuration = 250; // Adjusted duration for faster animation
        const spinCount = 5; // Number of spins

        // Randomly select the starting position in the outcome sequence
        const startingIndex = Math.floor(Math.random() * roulettePattern.length); // Starting point for animation

        // Get a random outcome for the middle position
        const randomOutcomeIndex = Math.floor(Math.random() * roulettePattern.length);
        const randomOutcome = roulettePattern[randomOutcomeIndex];

        // Initialize the first message with a different starting point
        const message = await interaction.editReply(createRouletteWheel((startingIndex + 1) % roulettePattern.length)); // First edit starts one position ahead

        // Animate the roulette
        for (let i = 0; i < spinCount; i++) {
            await delay(animationDuration);
            const index = (startingIndex + i + 1) % roulettePattern.length; // Move sequentially
            await message.edit(createRouletteWheel(index)); // Update the message
        }

        await delay(animationDuration); // Wait a moment before showing the final result
        await message.edit(createRouletteWheel(2, randomOutcome)); // Show the random result in the middle

        isRouletteInUse = false; // Unlock the command
    },
};

// Function to create the roulette wheel layout
function createRouletteWheel(startIndex, outcomeEmoji = '') {
    const topRow = `${emojis.whiteSquare}${emojis.whiteSquare}${emojis.arrowDown}${emojis.whiteSquare}${emojis.whiteSquare}`;
    
    // Populate result row with the fixed pattern
    const resultRow = roulettePattern.map((emoji, index) => {
        return roulettePattern[(startIndex + index) % roulettePattern.length];
    });

    // Place the outcome emoji in the middle position of the result row
    resultRow[2] = outcomeEmoji || resultRow[2]; // Middle emoji index if outcomeEmoji is passed

    return `${topRow}\n${resultRow.join('')}`; // Return the complete wheel layout
}

// Function to delay execution
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
