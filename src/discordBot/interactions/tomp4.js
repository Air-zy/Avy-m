const downloadAny = require("../modules/downloadAny.js");
module.exports = async (interaction, client) => {
    const url = interaction.options.getString('url');
    if (url == null) { return; }
    
    await interaction.reply({ content: "downloading..." });
    const mp4videoUrl = await downloadAny(url);

    if (mp4videoUrl) {
      await interaction.editReply({ content: "sending..." });
      interaction.editReply({
        content: "",
        files: [{
          attachment: mp4videoUrl,
          content_type: 'video/mp4',
          name: `${Date.now()}.mp4`
        }]
      })
    } else {
      interaction.editReply({
        content: "url not found sorry!" + toText(mp4videoUrl),
      })
    }
};
