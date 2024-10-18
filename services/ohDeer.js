module.exports = (client) => {
    // Listen for message events
    client.on("messageCreate", async (message) => {
      if (message.author.bot) return;
  
      // Check if the message contains "oh" and "deer"
      if (
        message.content.toLowerCase().includes("oh") &&
        message.content.toLowerCase().includes("deer")
      ) {
        await message.reply("shut the FUCK up");
      }
    });
  
    // You can add more logic for other events here
  };
  