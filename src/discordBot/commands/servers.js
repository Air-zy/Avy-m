module.exports = {
  name: 'servers',
  aliases: [],
  adminOnly: false,

  execute: async ({ message, client, discordjs }) => {
    const guilds = await client.guilds.fetch();

    const lines = [];
    const owners = new Map();

    for (const [, partialGuild] of guilds) {
      const guild = await partialGuild.fetch();

      lines.push(`[${guild.memberCount}] ${guild.name} \`${guild.id}\``);

      const ownerId = guild.ownerId;
      if (!owners.has(ownerId)) owners.set(ownerId, []);
      owners.get(ownerId).push({
        memberCount: guild.memberCount,
        name: guild.name,
        id: guild.id,
      });
    }

    const pages = [];
    let current = '';

    for (const line of lines) {
      if ((current + line + '\n').length > 3900) {
        pages.push(current);
        current = '';
      }
      current += line + '\n';
    }
    if (current) pages.push(current);

    const multiOwners = [...owners.entries()]
      .filter(([, guildList]) => guildList.length > 1)
      .map(([ownerId, guildList]) => {
        const servers = guildList
          .map(g => `[${g.memberCount}] ${g.name} \`${g.id}\``)
          .join('\n');
        return `multiowner: ${ownerId}: ${servers}\n`;
      });

    if (multiOwners.length) {
      let ownerPage = '';
      for (const line of multiOwners) {
        if ((ownerPage + line + '\n').length > 3900) {
          pages.push(ownerPage);
          ownerPage = '';
        }
        ownerPage += line + '\n';
      }
      if (ownerPage) pages.push(ownerPage);
    }

    for (let i = 0; i < pages.length; i++) {
      const embed = new discordjs.EmbedBuilder()
        .setColor('#DC143C')
        .setTitle(`Servers (${i + 1}/${pages.length})`)
        .setDescription(pages[i]);

      await message.channel.send({ embeds: [embed] });
    }
  },
};