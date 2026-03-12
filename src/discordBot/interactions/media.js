const { AttachmentBuilder } = require("discord.js");
const downloadAny = require("../modules/downloadAny.js");

module.exports = async (interaction, client) => {
  const search = interaction.options.getString('search');
  if (search == null) { return; }

  const channel = await client.channels.fetch(interaction.channelId);
  if (channel) { } else {
    return interaction.editReply({
      content: "could not find our interaction channel sorry!",
    })
  }

  console.log("channel found")
  await interaction.deferReply();

  interaction.editReply({
    content: "hi lol",
  })
};
