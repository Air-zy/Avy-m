module.exports = {
  name: 'vserver',
  aliases: [],
  adminOnly: true,

  execute: async ({ message, client, discordjs, utils }) => {
    const { toText } = utils;
    const mchannel = message.channel;
    const words = message.content.trim().split(/\s+/);
    const searchId = words[1]?.replace(/\D/g, '');

    if (!searchId) {
      await mchannel.send({ content: '```js\nguild not found\n```' });
      return;
    }

    const guilds = await client.guilds.fetch();
    let foundGuild;

    guilds.forEach((guild) => {
      if (toText(guild.id) === toText(searchId)) {
        foundGuild = guild;
      }
    });

    if (!foundGuild) {
      await mchannel.send({ content: '```js\nguild not found\n```' });
      return;
    }

    let guildInfo = '';
    const fetchedGuild = await client.guilds.fetch(searchId);

    if (fetchedGuild) {
      guildInfo += `owner_id: ${fetchedGuild.ownerId}\n`;
      guildInfo += `features: [${toText(foundGuild.features)}]\n\n`;
      guildInfo += '[CHANNELS]: \n';

      const fguildChannels = await fetchedGuild.channels.fetch();
      const channelsArray = Array.from(fguildChannels.values());

      channelsArray.sort((a, b) => {
        if (a.parentId === b.parentId) return a.rawPosition - b.rawPosition;
        if (b.parentId === a.id) return -1;
        if (a.parentId === b.id) return 1;
        return a.rawPosition - b.rawPosition;
      });

      channelsArray.forEach((channel) => {
        if (channel.type === 4) {
          guildInfo += `\n\n${channel.name}`;
        } else if (channel.type === 2) {
          guildInfo += `\n 𝄞 ${channel.name}, ${channel.type}   *${channel.id}*`;
        } else {
          guildInfo += `\n ◦ ${channel.name}, ${channel.type}   *${channel.id}*`;
        }
      });
    }

    const newEmbed = new discordjs.EmbedBuilder()
      .setColor('#DC143C')
      .setTitle(foundGuild.name)
      .setDescription(guildInfo.substring(0, 4096));

    await mchannel.send({
      content: '',
      embeds: [newEmbed],
    });
  },
};
