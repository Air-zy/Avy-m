module.exports = async (interaction) => {
    await interaction.reply({ content: '*gets pinged*' });
    const botLatency = Date.now() - interaction.createdTimestamp;
    const apiLatency = interaction.client.ws.ping;
    await interaction.editReply(
      `baka!\n` +
      `bot-server-host: ${botLatency}ms\n` +
      `discord-api: ${apiLatency}ms`
    );
};
