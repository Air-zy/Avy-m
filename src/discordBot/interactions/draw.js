const fs = require('fs');
const anigen = require("../anigen.js");
const configData = JSON.parse(fs.readFileSync('src/discordBot/json_storage/configs.json'));
const imgnamewatermark = configData[0].img_name_stamp

module.exports = async (interaction, client) => {
  try {
    const prompt = interaction.options.getString("prompt")
    if (!prompt) {
      return interaction.reply({ content: "No prompt provided.", ephemeral: true });
    }

    await interaction.reply({ content: "drawing..." });

    const result = await anigen.generate(prompt);
    if (!result) {
      return interaction.editReply({ content: "No response from generator." });
    }
    
    await interaction.editReply({
        content: "",
        files: [{
            attachment: result.msg,
            contentType: 'image/png',
            name: prompt.substring(0, 64) + imgnamewatermark + '.png'
        }]
    });
  } catch (err) {
    console.error("draw command error:", err);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: `Error: ${err.message || String(err)}` });
      } else {
        await interaction.reply({ content: `Error: ${err.message || String(err)}`, ephemeral: true });
      }
    } catch (e) {
      console.error("failed to inform user about error:", e);
    }
  }
};
