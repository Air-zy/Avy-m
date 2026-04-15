const os = require('os');

module.exports = {
  name: 'ping',
  aliases: ['info'],
  adminOnly: false,

  execute: async ({ message, client, discordjs }) => {
    const mchannel = message.channel;
    const start = Date.now();

    const rmsg = await mchannel.send({ content: 'A' });
    const latency = Date.now() - start;
    const wsPing = client.ws.ping;

    const newEmbed = new discordjs.EmbedBuilder()
      .setColor('#DC143C')
      .addFields(
        { name: 'websocket', value: String(wsPing), inline: true },
        { name: 'latency', value: String(latency), inline: true },
        { name: 'uptime', value: `${(process.uptime() / 60).toFixed(2)} minutes`, inline: true },
        { name: 'heap', value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
        {
          name: 'locals',
          value: Object.values(os.networkInterfaces())
            .flat()
            .filter(i => i.family === 'IPv4')
            .map(i => i.address)
            .join(', '),
          inline: false,
        }
      );

    await rmsg.edit({ content: '', embeds: [newEmbed] });
  },
};
