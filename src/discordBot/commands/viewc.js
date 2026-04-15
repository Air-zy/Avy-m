const { resolveChannelById } = require('../utils/channel');

module.exports = {
  name: 'viewc',
  aliases: ['view_channel'],
  adminOnly: true,

  execute: async ({ message, client, discordjs, utils }) => {
    const { reverseLines } = utils;
    const mchannel = message.channel;
    const words = message.content.trim().split(/\s+/);

    const channelId = words[1];
    if (!channelId) {
      await mchannel.send(`channel ${String(channelId).substring(0, 1024)} not found`);
      return;
    }

    const foundChannel = await resolveChannelById(client, channelId);
    if (!foundChannel) {
      await mchannel.send(`${channelId} not found`);
      return;
    }

    const prevMessages = await foundChannel.messages.fetch({ limit: 100 });
    let desctxt = '';

    prevMessages.forEach((msg) => {
      if (msg.attachments.size > 0) {
        msg.attachments.forEach((attachment) => {
          desctxt += `(file){${attachment.url}, ${attachment.name}}\n`;
        });
      }

      desctxt += `${msg.author.username}: ${msg.content.substring(0, 512)}\n`;
    });

    if (!desctxt.length) desctxt = '{empty}';
    desctxt = reverseLines(desctxt.substring(0, 4096));

    let embedTitle = foundChannel.name ?? 'null channel title';
    if (foundChannel.recipient) {
      embedTitle = `${foundChannel.recipientId} | ${foundChannel.recipient.username}`;
    }
    if (foundChannel.guild) {
      embedTitle = `${foundChannel.name} | guild: (${foundChannel.guild.name})(${foundChannel.guild.id})`;
    }

    const newEmbed = new discordjs.EmbedBuilder()
      .setTitle(embedTitle ?? 'null channel title')
      .setColor('#DC143C')
      .setDescription(desctxt);

    await mchannel.send({
      content: '',
      embeds: [newEmbed],
    });
  },
};
