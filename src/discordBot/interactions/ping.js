module.exports = async (interaction) => {
    const reply = await interaction.reply({ content: '*gets pinged*', fetchReply: true });
    const botLatency = Date.now() - interaction.createdTimestamp;
    const apiLatency = interaction.client.ws.ping;
    await interaction.editReply(
      `owies! dont ping me ever again!\n` +
      `bot-server-host: ${botLatency}ms\n` +
      `discord-api: ${apiLatency}ms`
    );
};
