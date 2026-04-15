const { resolveChannelById } = require('../utils/channel');

module.exports = {
  name: 'delete_msgs',
  aliases: [],
  adminOnly: true,

  execute: async ({ message, client, discordjs }) => {
    const mchannel = message.channel;
    const words = message.content.trim().split(/\s+/);

    const channelId = words[1];
    const amountRaw = Number.parseInt(words[2], 10);

    if (!channelId) {
      await mchannel.send(`channel ${String(channelId).substring(0, 1024)} not found`);
      return;
    }

    const amount = Number.isFinite(amountRaw) ? Math.max(1, Math.min(amountRaw, 100)) : 10;
    const foundChannel = await resolveChannelById(client, channelId);

    if (!foundChannel) return;

    const originalMsg = await mchannel.send({ content: 'starting delete_msgs' });
    const messages = await foundChannel.messages.fetch({ limit: amount });

    let desctxt = '';
    let msgDelete = 0;

    for (const msg of messages.values()) {
      try {
        await msg.delete();
        msgDelete += 1;
        if ((msgDelete % 4) === 0) {
          await originalMsg.edit(`- deleting [${msgDelete}] ${msg.author.tag}:` + msg.content.substring(0, 1024));
        }
        desctxt += `\nDeleted message from ${msg.author.tag}: ${msg.content}`;
      } catch (error) {
        desctxt += `\nFailed to delete message from ${msg.author.tag}: ${error.message}`;
      }
    }

    desctxt = desctxt.substring(0, 4096).split('\n').reverse().join('\n');

    const newEmbed = new discordjs.EmbedBuilder()
      .setTitle(`Deleted ${msgDelete} messages`)
      .setColor('#DC143C')
      .setDescription(desctxt);

    await originalMsg.edit({
      content: '',
      embeds: [newEmbed],
    });
  },
};
