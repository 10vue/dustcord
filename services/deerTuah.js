module.exports = (client) => {
    // Listen for message events
    client.on("messageCreate", async (message) => {
      if (message.author.bot) return;
  
      // Check if the message contains "oh" and "deer"
      if (
        message.content.toLowerCase().includes("deer") &&
        message.content.toLowerCase().includes("tuah")
      ) {
        await message.reply("strawb on that thang");
      }
    });
  
    // You can add more logic for other events here
  };
  